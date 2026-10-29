import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import { hasPermission, type FrontendRole } from "@/lib/rbac";
import {
  hasSupabaseConfigured,
  subirArchivoEvidencia,
  generarUrlFirmada,
  MIME_PERMITIDOS,
  MAX_PESO_BYTES,
  type TipoMimePermitido,
} from "@/lib/supabase";

function buildIdFilter(id: string) {
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    return { $or: [{ _id: new ObjectId(id) }, { folio: id }] };
  }
  return { folio: id };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Verificación de identidad autenticada
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Conexión a MongoDB Atlas
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

  // 3. Resolución y validación del usuario canónico en MongoDB
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

  // 4. Búsqueda y validación de la incidencia
  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return Response.json({ error: "Identificador de incidencia inválido." }, { status: 400 });
  }

  const filter = buildIdFilter(id.trim());
  let incidencia;
  try {
    incidencia = await db.collection("incidencias_campus").findOne(filter);
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

  // 5. Scoping y verificación de acceso a la incidencia (mismas reglas que el detalle)
  const systemRole = canonicalUser.rol as FrontendRole;
  if (systemRole === "reportante" && incidencia.reportante?.id_usuario !== canonicalUser.id_usuario) {
    return Response.json(
      { error: "No tienes permiso para consultar las evidencias de un expediente ajeno." },
      { status: 403 }
    );
  }

  if (systemRole === "tecnico" && incidencia.tecnico_asignado?.id_usuario !== canonicalUser.id_usuario) {
    return Response.json(
      { error: "Solo el técnico asignado puede consultar las evidencias de esta incidencia." },
      { status: 403 }
    );
  }

  // 6. Enriquecimiento de evidencias con URLs firmadas
  const rawEvidencias = Array.isArray(incidencia.evidencias_adjuntas) ? incidencia.evidencias_adjuntas : [];
  const evidenciasConUrl = await Promise.all(
    rawEvidencias.map(async (ev: unknown) => {
      const eObj = (ev ?? {}) as Record<string, unknown>;
      const key = eObj.storage_key
        ? String(eObj.storage_key)
        : eObj.url_storage
        ? String(eObj.url_storage)
        : undefined;
      const urlFirmada = key ? await generarUrlFirmada(key) : null;
      return {
        nombre_archivo: String(eObj.nombre_archivo ?? ""),
        tipo_mime: String(eObj.tipo_mime ?? ""),
        peso_kb: Number(eObj.peso_kb ?? 0),
        storage_key: key,
        url_storage: eObj.url_storage ? String(eObj.url_storage) : key,
        url_firmada: urlFirmada ?? undefined,
        fecha_carga:
          eObj.fecha_carga instanceof Date
            ? eObj.fecha_carga.toISOString()
            : String(eObj.fecha_carga ?? ""),
      };
    })
  );

  return Response.json(
    {
      evidencias_adjuntas: evidenciasConUrl,
    },
    { status: 200 }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Verificación de identidad autenticada
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Conexión a MongoDB Atlas
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

  // 3. Resolución y validación del usuario canónico en MongoDB
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

  const systemRole = canonicalUser.rol as FrontendRole;
  if (!hasPermission(systemRole, "evidencia:upload")) {
    return Response.json(
      { error: "Tu rol no tiene permisos para adjuntar evidencias." },
      { status: 403 }
    );
  }

  // 4. Búsqueda y validación de la incidencia
  const { id } = await context.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return Response.json({ error: "Identificador de incidencia inválido." }, { status: 400 });
  }

  const filter = buildIdFilter(id.trim());
  let incidencia;
  try {
    incidencia = await db.collection("incidencias_campus").findOne(filter);
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

  // 5. Scoping y verificación de acceso a la incidencia
  // - Reportante solo puede adjuntar a sus propias incidencias
  // - Técnico solo puede adjuntar si está formalmente asignado a la incidencia
  // - Coordinador y Admin tienen acceso institucional completo
  if (systemRole === "reportante" && incidencia.reportante?.id_usuario !== canonicalUser.id_usuario) {
    return Response.json(
      { error: "No tienes permiso para adjuntar evidencias a un expediente ajeno." },
      { status: 403 }
    );
  }

  if (systemRole === "tecnico" && incidencia.tecnico_asignado?.id_usuario !== canonicalUser.id_usuario) {
    return Response.json(
      { error: "Solo el técnico asignado puede adjuntar evidencias técnicas a esta incidencia." },
      { status: 403 }
    );
  }

  // 6. Extracción y validación del archivo binario (soporta 'file' y 'archivo')
  const contentType = request.headers.get("content-type") || "";
  let archivoBuffer: Buffer;
  let nombreArchivo: string;
  let tipoMime: string;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = (formData.get("file") || formData.get("archivo")) as File | null;
      if (!file || !(file instanceof File)) {
        return Response.json(
          { error: "No se proporcionó ningún archivo en el campo 'file' o 'archivo'." },
          { status: 400 }
        );
      }

      if (!MIME_PERMITIDOS.includes(file.type as TipoMimePermitido)) {
        return Response.json(
          { error: "Tipo de archivo no permitido. Solo se permiten PNG, JPG o PDF." },
          { status: 400 }
        );
      }

      if (file.size > MAX_PESO_BYTES) {
        return Response.json(
          { error: "El archivo excede el tamaño máximo permitido de 5 MB." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      archivoBuffer = Buffer.from(arrayBuffer);
      nombreArchivo = file.name;
      tipoMime = file.type;
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        nombre_archivo?: string;
        tipo_mime?: string;
        contenido_base64?: string;
      };

      if (!body.nombre_archivo || !body.tipo_mime || !body.contenido_base64) {
        return Response.json(
          { error: "Faltan campos requeridos: nombre_archivo, tipo_mime o contenido_base64." },
          { status: 400 }
        );
      }

      if (!MIME_PERMITIDOS.includes(body.tipo_mime as TipoMimePermitido)) {
        return Response.json(
          { error: "Tipo de archivo no permitido. Solo se permiten PNG, JPG o PDF." },
          { status: 400 }
        );
      }

      archivoBuffer = Buffer.from(body.contenido_base64, "base64");
      if (archivoBuffer.length > MAX_PESO_BYTES) {
        return Response.json(
          { error: "El archivo excede el tamaño máximo permitido de 5 MB." },
          { status: 400 }
        );
      }

      nombreArchivo = String(body.nombre_archivo);
      tipoMime = String(body.tipo_mime);
    } else {
      return Response.json(
        { error: "Content-Type no soportado. Envíe multipart/form-data o application/json." },
        { status: 400 }
      );
    }
  } catch {
    return Response.json(
      { error: "Error al procesar el archivo o cuerpo de la petición." },
      { status: 400 }
    );
  }

  // 7. Carga física a Supabase Storage
  if (!hasSupabaseConfigured()) {
    return Response.json(
      { error: "El servicio de Supabase Storage no está configurado en las variables de entorno del servidor." },
      { status: 503 }
    );
  }

  let uploadResult;
  try {
    uploadResult = await subirArchivoEvidencia({
      archivoBuffer,
      nombreArchivo,
      tipoMime,
      categoria: incidencia.categoria,
      folio: incidencia.folio,
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al almacenar el archivo en Supabase Storage.";
    return Response.json(
      { error: rawMessage },
      { status: 502 }
    );
  }

  // 8. Persistencia de metadatos y auditoría atómica en MongoDB Atlas
  const now = new Date();
  const nombreLimpio = nombreArchivo.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const nuevaEvidencia = {
    nombre_archivo: nombreLimpio,
    tipo_mime: tipoMime,
    peso_kb: uploadResult.pesoKb,
    storage_key: uploadResult.storageKey,
    url_storage: uploadResult.storageKey,
    fecha_carga: now,
  };

  try {
    const updateOp = {
      $push: {
        evidencias_adjuntas: nuevaEvidencia,
        historial_seguimiento: {
          fecha: now,
          autor: canonicalUser.nombre,
          estado_nuevo: incidencia.estado,
          horas_sumadas: 0,
          comentario: `Se adjuntó evidencia: ${nombreLimpio} (${tipoMime}, ${uploadResult.pesoKb} KB).`,
        },
      },
    };

    await db.collection("incidencias_campus").updateOne(
      filter,
      updateOp as unknown as Parameters<ReturnType<typeof db.collection>["updateOne"]>[1]
    );
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al actualizar la incidencia en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  // 9. Generación de URL firmada temporal y recuperación de la lista consolidada
  const urlFirmada = await generarUrlFirmada(uploadResult.storageKey);

  const docActualizado = await db.collection("incidencias_campus").findOne(filter, {
    projection: { evidencias_adjuntas: 1 },
  });

  const evidenciasConsolidadas = await Promise.all(
    (Array.isArray(docActualizado?.evidencias_adjuntas) ? docActualizado.evidencias_adjuntas : [nuevaEvidencia]).map(
      async (ev: unknown) => {
        const eObj = (ev ?? {}) as Record<string, unknown>;
        const key = eObj.storage_key
          ? String(eObj.storage_key)
          : eObj.url_storage
          ? String(eObj.url_storage)
          : undefined;
        const firmada = key ? await generarUrlFirmada(key) : null;
        return {
          nombre_archivo: String(eObj.nombre_archivo ?? ""),
          tipo_mime: String(eObj.tipo_mime ?? ""),
          peso_kb: Number(eObj.peso_kb ?? 0),
          storage_key: key,
          url_storage: eObj.url_storage ? String(eObj.url_storage) : key,
          url_firmada: firmada ?? undefined,
          fecha_carga:
            eObj.fecha_carga instanceof Date
              ? eObj.fecha_carga.toISOString()
              : String(eObj.fecha_carga ?? ""),
        };
      }
    )
  );

  const dataSubdocumento = {
    nombre_archivo: nuevaEvidencia.nombre_archivo,
    tipo_mime: nuevaEvidencia.tipo_mime,
    peso_kb: nuevaEvidencia.peso_kb,
    storage_key: nuevaEvidencia.storage_key,
    url_storage: nuevaEvidencia.url_storage,
    url_firmada: urlFirmada,
    fecha_carga: now.toISOString(),
  };

  return Response.json(
    {
      data: dataSubdocumento,
      evidencias_adjuntas: evidenciasConsolidadas,
    },
    { status: 201 }
  );
}
