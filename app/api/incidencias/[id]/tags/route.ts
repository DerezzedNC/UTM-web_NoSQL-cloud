import { z } from "zod";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { hasPermission, type FrontendRole } from "@/lib/rbac";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";

const tagsBodySchema = z.object({
  action: z.enum(["add", "remove"], {
    error: "La acción debe ser 'add' o 'remove'.",
  }),
  tag: z
    .string({ error: "La etiqueta debe ser una cadena de texto." })
    .trim()
    .min(1, "La etiqueta no puede estar vacía.")
    .max(50, "La etiqueta no puede exceder 50 caracteres."),
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

  // 4. Validación del esquema con Zod
  const parseResult = tagsBodySchema.safeParse(rawBody);
  if (!parseResult.success) {
    return Response.json(
      {
        error: "tag y action son obligatorios y deben ser válidos.",
        detalles: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { action, tag } = parseResult.data;

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
  if (!hasPermission(canonicalRole, "incidencia:tags")) {
    return Response.json(
      { error: "El usuario activo no cuenta con permisos suficientes para gestionar etiquetas en UTM Desk." },
      { status: 403 }
    );
  }

  // 7. Actualización atómica en la colección incidencias_campus
  const col = db.collection("incidencias_campus");
  const idFilter = buildIdFilter(id.trim());

  const updateOperation: Record<string, unknown> =
    action === "add"
      ? { $addToSet: { tags: tag } }
      : { $pull: { tags: tag } };

  let updatedDoc;
  try {
    updatedDoc = await col.findOneAndUpdate(idFilter, updateOperation, {
      returnDocument: "after",
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al actualizar etiquetas en MongoDB Atlas.";
    return Response.json(
      { error: sanitizeMongoError(rawMessage) },
      { status: 503 }
    );
  }

  if (!updatedDoc) {
    return Response.json({ error: "Incidencia no encontrada." }, { status: 404 });
  }

  const updatedTags = Array.isArray(updatedDoc.tags)
    ? (updatedDoc.tags as string[]).map(String)
    : [];

  return Response.json({ data: updatedTags }, { status: 200 });
}
