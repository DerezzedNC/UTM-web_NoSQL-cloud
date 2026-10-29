import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  verifySessionToken,
  getSessionUser,
  buildSessionCookie,
  buildClearSessionCookie,
  type AuthUser,
} from "../lib/auth";

// Asignar AUTH_SECRET válido si no está presente en el proceso de pruebas
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("Autenticación y Sesiones Seguras en Servidor (lib/auth.ts)", () => {
  const sampleUser: AuthUser = {
    id_usuario: "usr_doc_01",
    nombre: "Dra. Patricia Ortiz",
    correo: "ortiz@utm.edu.mx",
    rol: "reportante",
    rol_institucional: "Docente",
    departamento: "Sistemas Computacionales",
  };

  test("Emite y verifica un JWT HS256 server-side correctamente", async () => {
    const token = await createSessionToken(sampleUser, "1h");
    assert.equal(typeof token, "string");
    assert.ok(token.length > 20);

    const verified = await verifySessionToken(token);
    assert.ok(verified !== null);
    assert.equal(verified?.id_usuario, sampleUser.id_usuario);
    assert.equal(verified?.rol, "reportante");
    assert.equal(verified?.rol_institucional, "Docente");
    assert.equal(verified?.correo, "ortiz@utm.edu.mx");
  });

  test("Rechaza tokens alterados, vacíos o manipulados", async () => {
    const token = await createSessionToken(sampleUser, "1h");
    const tampered = token.slice(0, -6) + "xxxxxx";

    const verifiedTampered = await verifySessionToken(tampered);
    assert.equal(verifiedTampered, null);

    const verifiedEmpty = await verifySessionToken("");
    assert.equal(verifiedEmpty, null);

    const verifiedGarbage = await verifySessionToken("not-a-jwt-token");
    assert.equal(verifiedGarbage, null);
  });

  test("getSessionUser extrae y verifica identidad desde Authorization: Bearer <token>", async () => {
    const token = await createSessionToken(sampleUser, "1h");
    const request = new Request("http://localhost:3000/api/incidencias", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const user = await getSessionUser(request);
    assert.ok(user !== null);
    assert.equal(user?.id_usuario, sampleUser.id_usuario);
    assert.equal(user?.rol, "reportante");
  });

  test("getSessionUser extrae y verifica identidad desde cookie HttpOnly utm_session", async () => {
    const token = await createSessionToken(sampleUser, "1h");
    const request = new Request("http://localhost:3000/api/incidencias", {
      headers: {
        cookie: `utm_session=${token}; other_cookie=123`,
      },
    });

    const user = await getSessionUser(request);
    assert.ok(user !== null);
    assert.equal(user?.id_usuario, sampleUser.id_usuario);
  });

  test("getSessionUser no confía en x-user-role sin sesión válida", async () => {
    const request = new Request("http://localhost:3000/api/incidencias", {
      headers: {
        "x-user-role": "admin", // Intentar escalar privilegios falsificando header
      },
    });

    const user = await getSessionUser(request);
    assert.equal(user, null);
  });

  test("Genera encabezados de cookies HttpOnly con SameSite=Lax", () => {
    const cookie = buildSessionCookie("sample-token-123", 3600);
    assert.ok(cookie.includes("utm_session=sample-token-123"));
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("SameSite=Lax"));
    assert.ok(cookie.includes("Path=/"));

    const clearCookie = buildClearSessionCookie();
    assert.ok(clearCookie.includes("utm_session="));
    assert.ok(clearCookie.includes("Max-Age=0"));
  });
});
