import { buildClearSessionCookie } from "@/lib/auth";

export async function POST() {
  return Response.json(
    { data: { ok: true, mensaje: "Sesión cerrada correctamente." } },
    {
      status: 200,
      headers: {
        "Set-Cookie": buildClearSessionCookie(),
      },
    }
  );
}
