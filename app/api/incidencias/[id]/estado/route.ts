import { z } from "zod";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { canCloseTicket, hasPermission, type FrontendRole } from "@/lib/rbac";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import type { IncidenciaCampus } from "@/lib/incidencias/types";

const estadoParamSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "en proceso") return "en_proceso";
      if (trimmed === "en espera") return "en_espera";
      return trimmed;
    }
    return val;
  },
  z.enum(["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"], {
    error: "El estado proporcionado no es válido.",
  })
);

const actualizarEstadoSchema = z.object({
  estado_nuevo: estadoParamSchema,
  horas_sumadas: z.coerce.number().min(0, "Las horas sumadas deben ser mayores o iguales a 0."),
  comentario: z.string().trim().min(1, "El comentario de seguimiento es obligatorio."),
  autor: z.string().trim().optional(),
  estado_actual: estadoParamSchema.optional(),
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
          tecnico_asignado: doc.tecnico_asignado as IncidenciaCampus extends { tecnico_asignado?: infer T }
            ? T
            : never,
        }
      : {}),
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  // 1. Verificación de identidad autenticada en el servidor (JWT / cookie HttpOnly)
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Validación del identificador de incidencia
  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return Response.json({ error: "Identificador de incidencia inválido." }, { status: 400 });
  }

  // 3. Validación sintáctica de JSON en el cuerpo
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "El cuerpo de la petición debe ser un JSON válido." },
      { status: 400 }
    );
  }

  // 4. Validación del esquema del cuerpo de actualización
  const parseResult = actualizarEstadoSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return Response.json(
      {
        error: "estado_nuevo, horas_sumadas y comentario son obligatorios y deben ser válidos.",
        detalles: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { estado_nuevo, horas_sumadas, comentario, autor, estado_actual } = parseResult.data;

  // 5. Conexión a MongoDB Atlas
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

  // 6. Verificación de usuario canónico activo y vigencia de su rol en MongoDB
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
  if (!hasPermission(canonicalRole, "incidencia:update")) {
    return Response.json(
      { error: "El usuario activo no cuenta con permisos suficientes para actualizar incidencias en UTM Desk." },
      { status: 403 }
    );
  }

  const col = db.collection("incidencias_campus");
  const idFilter = buildIdFilter(id.trim());

  // 7. Consulta de la incidencia existente para validar transición y estado actual
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

  // 8. Reglas de transición de estado y políticas de rol evaluadas con la identidad canónica
  if (canonicalRole === "tecnico" && estado_nuevo === "cerrada") {
    return Response.json(
      { error: "El rol Técnico solo puede avanzar hasta resuelta." },
      { status: 403 }
    );
  }

  if (estado_nuevo === "cerrada" && !canCloseTicket(canonicalRole)) {
    return Response.json(
      { error: "Solo Coordinador o Administrador pueden cerrar definitivamente." },
      { status: 403 }
    );
  }

  if (incidencia.estado === "cerrada" && !canCloseTicket(canonicalRole)) {
    return Response.json(
      { error: "Una incidencia cerrada solo puede ser modificada o reabierta por Coordinador o Administrador." },
      { status: 403 }
    );
  }

  // Control de concurrencia optimista si el cliente envió el estado previo que observó
  if (estado_actual && estado_actual !== incidencia.estado) {
    return Response.json(
      { error: "Conflicto de concurrencia: el estado de la incidencia cambió antes de aplicar su actualización." },
      { status: 409 }
    );
  }

  // 9. Ejecución de actualización atómica en MongoDB
  const updateOperation: Record<string, unknown> = {
    $set: {
      estado: estado_nuevo,
    },
    $inc: {
      horas_invertidas: horas_sumadas,
    },
    $push: {
      historial_seguimiento: {
        $each: [
          {
            fecha: new Date(),
            autor: autor?.trim() || String(canonicalUser.nombre || sessionUser.nombre || "Usuario actual"),
            estado_nuevo,
            horas_sumadas,
            comentario: comentario.trim(),
          },
        ],
        $position: 0,
      },
    },
  };

  if (estado_nuevo === "resuelta" || estado_nuevo === "cerrada") {
    (updateOperation.$set as Record<string, unknown>).fecha_resolucion = new Date();
  } else {
    updateOperation.$unset = { fecha_resolucion: "" };
  }

  const concurrencyFilter = {
    ...idFilter,
    estado: incidencia.estado,
  };

  let updatedDoc;
  try {
    updatedDoc = await col.findOneAndUpdate(
      concurrencyFilter,
      updateOperation,
      { returnDocument: "after" }
    );
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al actualizar la incidencia en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  if (!updatedDoc) {
    return Response.json(
      { error: "Conflicto de concurrencia: el estado de la incidencia fue modificado por otra operación simultánea." },
      { status: 409 }
    );
  }

  return Response.json({ data: formatIncidencia(updatedDoc as Record<string, unknown>) }, { status: 200 });
}
