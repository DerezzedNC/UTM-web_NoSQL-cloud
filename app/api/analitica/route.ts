import { getSessionUser } from "@/lib/auth";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import { hasPermission, type FrontendRole } from "@/lib/rbac";

export async function GET(request: Request) {
  // 1. Verificación de identidad autenticada mediante sesión JWT
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

  // 3. Resolución del usuario canónico activo en MongoDB
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

  // 4. Validación de permisos RBAC para analítica (admin, directiva, coordinador)
  const canonicalRole = canonicalUser.rol as FrontendRole;
  if (!hasPermission(canonicalRole, "analitica:read")) {
    return Response.json(
      { error: "No tienes permisos suficientes para consultar la analítica del campus." },
      { status: 403 }
    );
  }

  // 5. Agregaciones nativas de MongoDB Atlas sobre la colección incidencias_campus
  try {
    const col = db.collection("incidencias_campus");

    const [eficienciaRaw, topTagsRaw] = await Promise.all([
      col
        .aggregate([
          { $match: { estado: { $in: ["resuelta", "cerrada"] } } },
          {
            $group: {
              _id: "$ubicacion.edificio",
              tickets_resueltos_cerrados: { $sum: 1 },
              horas_totales: { $sum: "$horas_invertidas" },
              promedio_horas: { $avg: "$horas_invertidas" },
            },
          },
          { $sort: { tickets_resueltos_cerrados: -1, horas_totales: -1 } },
        ])
        .toArray(),
      col
        .aggregate([
          { $unwind: "$tags" },
          { $group: { _id: "$tags", frecuencia: { $sum: 1 } } },
          { $sort: { frecuencia: -1, _id: 1 } },
          { $limit: 10 },
        ])
        .toArray(),
    ]);

    const eficiencia_por_edificio = eficienciaRaw.map((item) => ({
      edificio: String(item._id ?? "Sin edificio"),
      tickets_resueltos_cerrados: Number(item.tickets_resueltos_cerrados ?? 0),
      horas_totales: Number(item.horas_totales ?? 0),
      promedio_horas: Number(item.promedio_horas ?? 0),
    }));

    const top_tags = topTagsRaw.map((item) => ({
      tag: String(item._id ?? ""),
      frecuencia: Number(item.frecuencia ?? 0),
    }));

    return Response.json({
      eficiencia_por_edificio,
      top_tags,
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al generar la analítica en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }
}
