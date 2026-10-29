import { z } from "zod";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { hasPermission, type FrontendRole } from "@/lib/rbac";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import { PRIORIDAD_META, TECNICOS_DISPONIBLES } from "@/lib/incidencias/constants";
import { PRIORIDADES, type IncidenciaCampus, type Prioridad, type TecnicoAsignado } from "@/lib/incidencias/types";

const triageSchema = z.object({
  prioridad: z.enum(["baja", "media", "alta", "critica"]).optional(),
  id_tecnico: z.string().nullable().optional(),
  riesgo_seguridad: z.enum(["Bajo", "Medio", "Alto", "Crítico", "Critico"]).optional(),
  autor: z.string().trim().optional(),
});

function buildIdFilter(id: string): Record<string, unknown> {
  const isFolio = /^INC-[0-9]{4}-[0-9]{4}$/i.test(id);
  if (isFolio) {
    return { folio: id };
  }
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    return {
      $or: [{ _id: new ObjectId(id) }, { _id: id }, { folio: id }],
    };
  }
  return {
    $or: [{ _id: id }, { folio: id }],
  };
}

function formatIncidencia(doc: Record<string, unknown>): IncidenciaCampus {
  const reportanteRaw = (doc.reportante ?? {}) as Record<string, unknown>;
  const ubicacionRaw = (doc.ubicacion ?? {}) as Record<string, unknown>;

  return {
    _id: String(doc._id),
    folio: String(doc.folio ?? ""),
    titulo: String(doc.titulo ?? ""),
    descripcion: String(doc.descripcion ?? ""),
    prioridad: doc.prioridad as IncidenciaCampus["prioridad"],
    categoria: doc.categoria as IncidenciaCampus["categoria"],
    estado: doc.estado as IncidenciaCampus["estado"],
    horas_invertidas: Number(doc.horas_invertidas ?? 0),
    fecha_creacion:
      doc.fecha_creacion instanceof Date
        ? doc.fecha_creacion.toISOString()
        : String(doc.fecha_creacion ?? ""),
    ...(doc.fecha_resolucion
      ? {
          fecha_resolucion:
            doc.fecha_resolucion instanceof Date
              ? doc.fecha_resolucion.toISOString()
              : String(doc.fecha_resolucion),
        }
      : {}),
    reportante: {
      id_usuario: String(reportanteRaw.id_usuario ?? ""),
      nombre: String(reportanteRaw.nombre ?? ""),
      rol_institucional: reportanteRaw.rol_institucional as IncidenciaCampus["reportante"]["rol_institucional"],
      correo: String(reportanteRaw.correo ?? ""),
      ...(reportanteRaw.rol ? { rol: reportanteRaw.rol as IncidenciaCampus["reportante"]["rol_institucional"] } : {}),
    },
    ubicacion: {
      edificio: String(ubicacionRaw.edificio ?? ""),
      piso: String(ubicacionRaw.piso ?? ""),
      aula_laboratorio: String(ubicacionRaw.aula_laboratorio ?? ""),
    },
    detalle_especifico: doc.detalle_especifico as IncidenciaCampus["detalle_especifico"],
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
    historial_seguimiento: Array.isArray(doc.historial_seguimiento)
      ? doc.historial_seguimiento.map((h: unknown) => {
          const hObj = (h ?? {}) as Record<string, unknown>;
          return {
            fecha:
              hObj.fecha instanceof Date
                ? hObj.fecha.toISOString()
                : String(hObj.fecha ?? ""),
            autor: String(hObj.autor ?? ""),
            estado_nuevo: hObj.estado_nuevo as IncidenciaCampus["estado"],
            horas_sumadas: Number(hObj.horas_sumadas ?? 0),
            comentario: String(hObj.comentario ?? ""),
          };
        })
      : [],
    evidencias_adjuntas: Array.isArray(doc.evidencias_adjuntas)
      ? doc.evidencias_adjuntas.map((e: unknown) => {
          const eObj = (e ?? {}) as Record<string, unknown>;
          return {
            nombre_archivo: String(eObj.nombre_archivo ?? ""),
            tipo_mime: String(eObj.tipo_mime ?? ""),
            peso_kb: Number(eObj.peso_kb ?? 0),
            storage_key: eObj.storage_key ? String(eObj.storage_key) : undefined,
            url_storage: eObj.url_storage ? String(eObj.url_storage) : undefined,
            fecha_carga:
              eObj.fecha_carga instanceof Date
                ? eObj.fecha_carga.toISOString()
                : String(eObj.fecha_carga ?? ""),
          };
        })
      : [],
    ...(doc.tecnico_asignado
      ? {
          tecnico_asignado: doc.tecnico_asignado as TecnicoAsignado,
        }
      : {}),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  // 1. Verificación de identidad autenticada
  const sessionUser = await getSessionUser(_request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Validación de id de incidencia
  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return Response.json({ error: "Identificador de incidencia inválido." }, { status: 400 });
  }

  // 3. Conexión a MongoDB Atlas
  let db;
  try {
    db = await getDb();
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al conectar con MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  // 4. Búsqueda de la incidencia
  let doc;
  try {
    doc = await db.collection("incidencias_campus").findOne(buildIdFilter(id.trim()));
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al consultar incidencia en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  if (!doc) {
    return Response.json({ error: "Incidencia no encontrada." }, { status: 404 });
  }

  // 5. Control de visibilidad por rol en el servidor
  if (sessionUser.rol === "reportante") {
    const rep = (doc.reportante ?? {}) as Record<string, unknown>;
    const esSuya =
      String(rep.id_usuario ?? "") === sessionUser.id_usuario ||
      String(rep.correo ?? "").toLowerCase() === sessionUser.correo.toLowerCase();
    if (!esSuya) {
      return Response.json(
        { error: "No tienes permiso para ver este expediente." },
        { status: 403 }
      );
    }
  } else if (sessionUser.rol === "tecnico") {
    const tec = (doc.tecnico_asignado ?? null) as Record<string, unknown> | null;
    const asignadaAEl =
      tec &&
      (String(tec.id_usuario ?? "") === sessionUser.id_usuario ||
        String(tec.correo ?? "").toLowerCase() === sessionUser.correo.toLowerCase());
    if (!asignadaAEl) {
      return Response.json(
        { error: "No tienes permiso para ver este expediente." },
        { status: 403 }
      );
    }
  }

  return Response.json({ data: formatIncidencia(doc) }, { status: 200 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  // 1. Verificación de identidad autenticada
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Validación de id de incidencia
  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return Response.json({ error: "Identificador de incidencia inválido." }, { status: 400 });
  }

  // 3. Validación de cuerpo JSON y esquema Zod
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "El cuerpo de la petición debe ser un JSON válido." },
      { status: 400 }
    );
  }

  const parseResult = triageSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return Response.json(
      { error: "Datos de clasificación inválidos.", detalles: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { prioridad, id_tecnico, riesgo_seguridad, autor } = parseResult.data;

  // 4. Conexión a MongoDB Atlas
  let db;
  try {
    db = await getDb();
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al conectar con MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  // 5. Verificación de usuario canónico activo y vigencia de rol en MongoDB
  let canonicalUser;
  try {
    canonicalUser = await db.collection("usuarios").findOne({
      id_usuario: sessionUser.id_usuario,
      activo: true,
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al consultar usuario en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  if (!canonicalUser) {
    return Response.json(
      { error: "La identidad autenticada no corresponde a un usuario activo registrado en el sistema." },
      { status: 403 }
    );
  }

  const canonicalRole = canonicalUser.rol as FrontendRole;
  if (!hasPermission(canonicalRole, "incidencia:triage")) {
    return Response.json(
      { error: "Solo el Coordinador o Administrador pueden clasificar y asignar incidencias." },
      { status: 403 }
    );
  }

  // 6. Consulta de la incidencia existente
  const col = db.collection("incidencias_campus");
  const idFilter = buildIdFilter(id.trim());

  let incidencia;
  try {
    incidencia = await col.findOne(idFilter);
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al consultar incidencia en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  if (!incidencia) {
    return Response.json({ error: "Incidencia no encontrada." }, { status: 404 });
  }

  // 7. Resolución y validación del técnico si fue proporcionado
  let nuevoTecnico: TecnicoAsignado | null | undefined = undefined;
  if (id_tecnico !== undefined) {
    if (!id_tecnico || id_tecnico.trim() === "") {
      nuevoTecnico = null;
    } else {
      const tecCatalog = TECNICOS_DISPONIBLES.find((item) => item.id_usuario === id_tecnico);
      if (tecCatalog) {
        nuevoTecnico = tecCatalog;
      } else {
        const tecDb = await db.collection("usuarios").findOne({
          id_usuario: id_tecnico,
          rol: "tecnico",
          activo: true,
        });
        if (!tecDb) {
          return Response.json(
            { error: "El técnico seleccionado no es válido o no está activo." },
            { status: 400 }
          );
        }
        nuevoTecnico = {
          id_usuario: tecDb.id_usuario,
          nombre: tecDb.nombre,
          correo: tecDb.correo,
          area: (tecDb.area_asignada ?? incidencia.categoria) as IncidenciaCampus["categoria"],
        };
      }
    }
  }

  // 8. Construcción de operaciones atómicas y bitácora
  const cambios: string[] = [];
  const setFields: Record<string, unknown> = {};
  const unsetFields: Record<string, unknown> = {};

  if (prioridad && PRIORIDADES.includes(prioridad as Prioridad) && prioridad !== incidencia.prioridad) {
    setFields.prioridad = prioridad;
    cambios.push(`Prioridad definida como ${PRIORIDAD_META[prioridad as Prioridad].etiqueta}`);
  }

  if (nuevoTecnico !== undefined) {
    const tecActual = (incidencia.tecnico_asignado ?? null) as TecnicoAsignado | null;
    if (nuevoTecnico === null) {
      if (tecActual) {
        unsetFields.tecnico_asignado = "";
        cambios.push("Se retiró la asignación de técnico");
      }
    } else if (!tecActual || tecActual.id_usuario !== nuevoTecnico.id_usuario) {
      setFields.tecnico_asignado = nuevoTecnico;
      cambios.push(`Asignada a ${nuevoTecnico.nombre}`);
    }
  }

  if (
    riesgo_seguridad &&
    incidencia.detalle_especifico &&
    typeof incidencia.detalle_especifico === "object" &&
    "riesgo_seguridad" in incidencia.detalle_especifico
  ) {
    const riesgoNorm = riesgo_seguridad === "Crítico" ? "Critico" : riesgo_seguridad;
    const currentRiesgo = (incidencia.detalle_especifico as Record<string, unknown>).riesgo_seguridad;
    if (currentRiesgo !== riesgoNorm && currentRiesgo !== riesgo_seguridad) {
      setFields["detalle_especifico.riesgo_seguridad"] = riesgoNorm;
      cambios.push(`Riesgo de seguridad evaluado como ${riesgo_seguridad}`);
    }
  }

  if (cambios.length === 0) {
    return Response.json({ data: formatIncidencia(incidencia) }, { status: 200 });
  }

  const updateOperation: Record<string, unknown> = {};
  if (Object.keys(setFields).length > 0) {
    updateOperation.$set = setFields;
  }
  if (Object.keys(unsetFields).length > 0) {
    updateOperation.$unset = unsetFields;
  }

  const logEntry = {
    fecha: new Date(),
    autor: autor?.trim() || String(canonicalUser.nombre || "Coordinación"),
    estado_nuevo: incidencia.estado,
    horas_sumadas: 0,
    comentario: `${cambios.join(" · ")}.`,
  };

  updateOperation.$push = {
    historial_seguimiento: {
      $each: [logEntry],
      $position: 0,
    },
  };

  let updatedDoc;
  try {
    updatedDoc = await col.findOneAndUpdate(idFilter, updateOperation, {
      returnDocument: "after",
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al clasificar incidencia en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  if (!updatedDoc) {
    return Response.json({ error: "Incidencia no encontrada." }, { status: 404 });
  }

  return Response.json({ data: formatIncidencia(updatedDoc) }, { status: 200 });
}
