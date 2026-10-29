import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import type { IncidenciaCampus } from "@/lib/incidencias/types";

const emptyToUndefined = (val: unknown) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const buscarParamsSchema = z.object({
  q: z.preprocess(
    emptyToUndefined,
    z.string().max(100, "El término de búsqueda no puede superar 100 caracteres.").optional()
  ),
  categoria: z.preprocess(
    emptyToUndefined,
    z.enum(["computo_redes", "infraestructura", "academico"], {
      error: "La categoría proporcionada no es válida.",
    }).optional()
  ),
  estado: z.preprocess(
    (val) => {
      const clean = emptyToUndefined(val);
      if (!clean) return undefined;
      if (clean === "en proceso") return "en_proceso";
      if (clean === "en espera") return "en_espera";
      return clean;
    },
    z.enum(["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"], {
      error: "El estado proporcionado no es válido.",
    }).optional()
  ),
  edificio: z.preprocess(
    emptyToUndefined,
    z.string().max(100, "El filtro de edificio no puede superar 100 caracteres.").optional()
  ),
  page: z.preprocess(
    (val) => {
      const clean = emptyToUndefined(val);
      return clean !== undefined ? clean : 1;
    },
    z.coerce
      .number()
      .int("La página debe ser un número entero.")
      .min(1, "La página debe ser mayor o igual a 1.")
  ),
  limit: z.preprocess(
    (val) => {
      const clean = emptyToUndefined(val);
      return clean !== undefined ? clean : 50;
    },
    z.coerce
      .number()
      .int("El límite debe ser un número entero.")
      .min(1, "El límite mínimo es 1.")
      .max(100, "El límite máximo es 100.")
  ),
});

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

export async function GET(request: Request) {
  // 1. Verificación de identidad autenticada en el servidor (JWT / cookie HttpOnly)
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Verificación de permisos RBAC del usuario autenticado
  if (!hasPermission(sessionUser.rol, "incidencia:read")) {
    return Response.json(
      { error: "No tienes permisos suficientes para consultar incidencias en UTM Desk." },
      { status: 403 }
    );
  }

  // 3. Validación y sanitización de parámetros de consulta
  const { searchParams } = new URL(request.url);
  const rawParams = {
    q: searchParams.get("q"),
    categoria: searchParams.get("categoria"),
    estado: searchParams.get("estado"),
    edificio: searchParams.get("edificio"),
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  };

  const parseResult = buscarParamsSchema.safeParse(rawParams);
  if (!parseResult.success) {
    return Response.json(
      {
        error: "Parámetros de búsqueda inválidos.",
        detalles: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { q, categoria, estado, edificio, page, limit } = parseResult.data;

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

  // 5. Construcción de consulta estructurada
  const baseFilter: Record<string, unknown> = {};

  if (categoria) {
    baseFilter.categoria = categoria;
  }
  if (estado) {
    baseFilter.estado = estado;
  }
  if (edificio) {
    baseFilter["ubicacion.edificio"] = {
      $regex: escapeRegex(edificio),
      $options: "i",
    };
  }

  const skip = (page - 1) * limit;
  const col = db.collection("incidencias_campus");

  let total = 0;
  let rawDocs: Record<string, unknown>[] = [];

  try {
    if (q) {
      try {
        const textFilter = { ...baseFilter, $text: { $search: q } };
        total = await col.countDocuments(textFilter);
        rawDocs = await col
          .find(textFilter, { projection: { score: { $meta: "textScore" } } })
          .sort({ score: { $meta: "textScore" }, fecha_creacion: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
      } catch (textErr: unknown) {
        const msg = textErr instanceof Error ? textErr.message.toLowerCase() : "";
        const errObj = textErr && typeof textErr === "object" ? (textErr as Record<string, unknown>) : {};
        const code = errObj.code;
        const codeName = errObj.codeName;

        const isMissingTextIndex =
          code === 27 ||
          codeName === "IndexNotFound" ||
          msg.includes("text index required") ||
          msg.includes("no text index") ||
          msg.includes("indexnotfound");

        if (isMissingTextIndex) {
          const regexFilter = {
            ...baseFilter,
            $or: [
              { titulo: { $regex: escapeRegex(q), $options: "i" } },
              { descripcion: { $regex: escapeRegex(q), $options: "i" } },
            ],
          };
          total = await col.countDocuments(regexFilter);
          rawDocs = await col
            .find(regexFilter)
            .sort({ fecha_creacion: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        } else {
          // Errores de red, conexión o permisos no deben convertirse en fallback
          throw textErr;
        }
      }
    } else {
      total = await col.countDocuments(baseFilter);
      rawDocs = await col
        .find(baseFilter)
        .sort({ fecha_creacion: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    }
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al consultar incidencias en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  // 6. Formateo y serialización de los documentos de respuesta
  const formattedData = rawDocs.map(formatIncidencia);

  return Response.json(
    {
      data: formattedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    },
    { status: 200 }
  );
}
