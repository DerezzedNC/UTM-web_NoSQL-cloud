import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json(
      { error: "No autenticado o sesión inválida." },
      { status: 401 }
    );
  }

  return Response.json({
    data: { user },
  });
}
