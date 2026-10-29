import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb, sanitizeMongoError } from "@/lib/mongodb";
import { createSessionToken, buildSessionCookie, type AuthUser } from "@/lib/auth";

const loginSchema = z.object({
  correo: z.string().trim().email("Formato de correo institucional inválido."),
  password: z.string().min(1, "La contraseña es requerida."),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Payload JSON inválido." },
      { status: 400 }
    );
  }

  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      { error: "Datos de autenticación inválidos.", detalles: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { correo, password } = parseResult.data;

  try {
    const db = await getDb();
    const normalizedEmail = correo.toLowerCase();
    const user = await db.collection("usuarios").findOne({
      correo: normalizedEmail,
      activo: true,
    });

    if (!user || !user.password_hash) {
      return Response.json(
        { error: "Credenciales inválidas o usuario inactivo." },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return Response.json(
        { error: "Credenciales inválidas o usuario inactivo." },
        { status: 401 }
      );
    }

    const authUser: AuthUser = {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      rol_institucional: user.rol_institucional,
      area_asignada: user.area_asignada,
      departamento: user.departamento,
    };

    const token = await createSessionToken(authUser);
    const cookieHeader = buildSessionCookie(token);

    return Response.json(
      {
        data: {
          user: authUser,
          token,
        },
      },
      {
        status: 200,
        headers: {
          "Set-Cookie": cookieHeader,
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar autenticación.";
    return Response.json(
      { error: sanitizeMongoError(msg) },
      { status: 503 }
    );
  }
}
