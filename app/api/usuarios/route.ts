import { USUARIOS_INICIALES } from "@/lib/usuarios/types";
import { usuarioSchema } from "@/lib/usuarios/schema";

export async function GET(request: Request) {
  if (request.headers.get("x-user-role") !== "admin") {
    return Response.json({ error: "Solo admin puede consultar usuarios." }, { status: 403 });
  }
  return Response.json({ data: USUARIOS_INICIALES });
}
export async function POST(request: Request) {
  if (request.headers.get("x-user-role") !== "admin") {
    return Response.json({ error: "Solo admin puede administrar usuarios." }, { status: 403 });
  }
  const result = usuarioSchema.safeParse(await request.json());
  if (!result.success) {
    return Response.json({ error: "Payload inválido para la colección usuarios.", issues: result.error.flatten() }, { status: 400 });
  }
  if (USUARIOS_INICIALES.some((user) => user.id_usuario === result.data.id_usuario || user.correo === result.data.correo)) {
    return Response.json({ error: "El id_usuario o correo ya existe en los índices únicos." }, { status: 409 });
  }
  const user = { _id: `usr-${crypto.randomUUID()}`, ...result.data };
  USUARIOS_INICIALES.push(user);
  return Response.json({ data: user }, { status: 201 });
}
