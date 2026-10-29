import { Int32 } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { hasPermission, type FrontendRole } from "@/lib/rbac";
import { registroIncidenciaSchema } from "@/lib/incidencias/registro-schema";
import { getAnioFolio, getNextFolio, sanitizeRedisError } from "@/lib/redis";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import { hasSupabaseConfigured, subirArchivoEvidencia } from "@/lib/supabase";

export async function POST(request: Request) {
  // 1. Verificación de identidad en el servidor (no confía en x-user-role)
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json(
      { error: "Autenticación requerida. Inicie sesión para continuar." },
      { status: 401 }
    );
  }

  // 2. Verificación de autorización en el servidor
  if (!hasPermission(sessionUser.rol, "incidencia:create")) {
    return Response.json(
      { error: "No tienes permisos suficientes para registrar incidencias en UTM Desk." },
      { status: 403 }
    );
  }

  // 3. Validación sintáctica de JSON en el cuerpo
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "El cuerpo de la petición debe ser un JSON válido." },
      { status: 400 }
    );
  }

  // 4. Validación de contrato y estructura del payload con Zod
  const result = registroIncidenciaSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      {
        error: "El payload no cumple con el contrato formal de incidencias_campus.",
        detalles: result.error.flatten(),
      },
      { status: 400 }
    );
  }

  // 5. Conexión a MongoDB Atlas y resolución de identidad canónica del reportante
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

  // 6. Validación de vigencia del rol de sistema y completitud del perfil institucional en la BD
  const canonicalSystemRole = canonicalUser.rol as FrontendRole;
  if (!hasPermission(canonicalSystemRole, "incidencia:create")) {
    return Response.json(
      { error: "El usuario activo no cuenta con permisos suficientes para registrar incidencias." },
      { status: 403 }
    );
  }

  const ROLES_INSTITUCIONALES_VALIDOS = ["Docente", "Estudiante", "Administrativo"] as const;
  type RolInstitucionalValido = (typeof ROLES_INSTITUCIONALES_VALIDOS)[number];

  const esRolInstitucionalValido = (rol: unknown): rol is RolInstitucionalValido =>
    typeof rol === "string" && ROLES_INSTITUCIONALES_VALIDOS.includes(rol as RolInstitucionalValido);

  const tienePerfilValido =
    typeof canonicalUser.id_usuario === "string" &&
    canonicalUser.id_usuario.trim().length > 0 &&
    typeof canonicalUser.nombre === "string" &&
    canonicalUser.nombre.trim().length > 0 &&
    typeof canonicalUser.correo === "string" &&
    canonicalUser.correo.trim().length > 0 &&
    esRolInstitucionalValido(canonicalUser.rol_institucional);

  if (!tienePerfilValido) {
    return Response.json(
      {
        error: "El perfil del usuario es incompleto o su rol institucional no es válido para registrar incidencias.",
      },
      { status: 403 }
    );
  }

  // Identidad del reportante derivada estrictamente de los campos canónicos verificados
  const canonicalReportante = {
    id_usuario: canonicalUser.id_usuario,
    nombre: canonicalUser.nombre,
    rol_institucional: canonicalUser.rol_institucional,
    rol: canonicalUser.rol_institucional,
    correo: canonicalUser.correo,
  };

  // 6. Convención temporal y asignación atómica de folio con Upstash Redis
  const now = new Date();
  const anio = getAnioFolio(now);

  let folio: string;
  try {
    const folioResult = await getNextFolio(anio);
    folio = folioResult.folio;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al generar folio atómico.";
    return Response.json(
      { error: sanitizeRedisError(msg) },
      { status: 503 }
    );
  }

  // 7. Construcción del documento formal con tipos BSON adecuados y subida a Supabase Storage
  const payload = result.data;

  const evidenciasSubidas = Array.isArray(payload.evidencias)
    ? await Promise.all(
        payload.evidencias.map(async (item) => {
          let storageKey = `evidencias-utm/${anio}/${payload.categoria}/${folio}/${item.nombre_archivo}`;
          let pesoKb = item.peso_kb;

          if (hasSupabaseConfigured() && item.contenido_base64) {
            try {
              const archivoBuffer = Buffer.from(item.contenido_base64, "base64");
              const uploaded = await subirArchivoEvidencia({
                archivoBuffer,
                nombreArchivo: item.nombre_archivo,
                tipoMime: item.tipo_mime,
                categoria: payload.categoria,
                folio,
              });
              storageKey = uploaded.storageKey;
              pesoKb = uploaded.pesoKb;
            } catch (uploadErr) {
              console.warn("[incidencias] Advertencia al subir evidencia a Supabase:", uploadErr);
            }
          }

          return {
            nombre_archivo: item.nombre_archivo,
            tipo_mime: item.tipo_mime,
            peso_kb: pesoKb,
            storage_key: storageKey,
            fecha_carga: now,
          };
        })
      )
    : [];

  const detalleBson =
    payload.categoria === "computo_redes"
      ? {
          direccion_ip: payload.detalle_especifico.direccion_ip,
          vlan: new Int32(Math.max(1, Math.min(4094, Math.trunc(payload.detalle_especifico.vlan)))),
          puerto_uplink: payload.detalle_especifico.puerto_uplink,
          equipos_afectados: new Int32(Math.max(1, Math.trunc(payload.detalle_especifico.equipos_afectados || 1))),
        }
      : payload.categoria === "infraestructura"
      ? {
          tipo_dano: payload.detalle_especifico.tipo_dano,
          riesgo_seguridad: payload.detalle_especifico.riesgo_seguridad,
          requiere_insumos: Boolean(payload.detalle_especifico.requiere_insumos),
          contratista_externo: Boolean(payload.detalle_especifico.contratista_externo),
        }
      : {
          plataforma: payload.detalle_especifico.plataforma,
          codigo_curso: payload.detalle_especifico.codigo_curso,
          periodo_escolar: payload.detalle_especifico.periodo_escolar,
          estudiantes_impactados: new Int32(Math.max(1, Math.trunc(payload.detalle_especifico.estudiantes_impactados || 1))),
        };

  const canonicalDocument = {
    folio,
    titulo: payload.titulo,
    descripcion: payload.descripcion,
    categoria: payload.categoria,
    prioridad: payload.prioridad ?? "media",
    estado: "abierta" as const,
    horas_invertidas: 0,
    fecha_creacion: now,
    reportante: {
      id_usuario: canonicalReportante.id_usuario,
      nombre: canonicalReportante.nombre,
      rol_institucional: canonicalReportante.rol_institucional,
      correo: canonicalReportante.correo,
    },
    ubicacion: {
      edificio: payload.ubicacion.edificio,
      piso: payload.ubicacion.piso,
      aula_laboratorio: payload.ubicacion.aula_laboratorio,
    },
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    historial_seguimiento: [
      {
        fecha: now,
        autor: canonicalUser.nombre,
        estado_nuevo: "abierta" as const,
        horas_sumadas: 0,
        comentario: "Incidencia registrada en UTM Desk.",
      },
    ],
    evidencias_adjuntas: evidenciasSubidas,
    detalle_especifico: detalleBson,
  };

  // 8. Persistencia real en MongoDB Atlas (colección incidencias_campus)
  try {
    const insertResult = await db.collection("incidencias_campus").insertOne(canonicalDocument);

    return Response.json(
      {
        data: {
          id: insertResult.insertedId.toString(),
          folio: canonicalDocument.folio,
          titulo: canonicalDocument.titulo,
          categoria: canonicalDocument.categoria,
          prioridad: canonicalDocument.prioridad,
          estado: canonicalDocument.estado,
          fecha_creacion: canonicalDocument.fecha_creacion.toISOString(),
          reportante: canonicalDocument.reportante,
          ubicacion: canonicalDocument.ubicacion,
          tags: canonicalDocument.tags,
          detalle_especifico: canonicalDocument.detalle_especifico,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const mongoError = err as { code?: number; message?: string };

    // Conflicto de unicidad en folio (índice único)
    if (mongoError?.code === 11000) {
      return Response.json(
        { error: "Conflicto de unicidad: el folio generado ya existe en la base de datos." },
        { status: 409 }
      );
    }

    // Violación del esquema formal $jsonSchema de MongoDB
    if (mongoError?.code === 121) {
      return Response.json(
        { error: "El documento no superó las reglas de validación formal ($jsonSchema) de MongoDB Atlas." },
        { status: 400 }
      );
    }

    const rawMessage = err instanceof Error ? err.message : "Error al persistir la incidencia en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }
}
