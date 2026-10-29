import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { POST as loginPOST } from "../app/api/auth/login/route";
import { GET as meGET } from "../app/api/auth/me/route";
import { POST as logoutPOST } from "../app/api/auth/logout/route";
import type { AuthUser } from "../lib/auth";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

type StoredUser = {
  id_usuario: string;
  nombre: string;
  correo: string;
  password_hash: string;
  rol: "reportante";
  rol_institucional: "Docente";
  departamento: string;
  activo: boolean;
  fecha_registro: Date;
};

describe("Endpoints de Autenticación (/api/auth/*)", () => {
  let mockUser: StoredUser;

  beforeEach(async () => {
    const passwordHash = await bcrypt.hash("DocentePass123", 10);
    mockUser = {
      id_usuario: "usr_doc_01",
      nombre: "Dra. Patricia Ortiz",
      correo: "ortiz@utm.edu.mx",
      password_hash: passwordHash,
      rol: "reportante",
      rol_institucional: "Docente",
      departamento: "Sistemas Computacionales",
      activo: true,
      fecha_registro: new Date(),
    };

    const mockDb = {
      databaseName: "utm_desk_db",
      collection: () => ({
        findOne: async (query: { correo?: string; activo?: boolean }) => {
          if (query.correo === mockUser.correo && query.activo === true) {
            return mockUser;
          }
          return null;
        },
      }),
    };

    global._mongoClientPromise = Promise.resolve({
      db: () => mockDb,
      connect: async () => ({ db: () => mockDb }),
    } as unknown as MongoClient);
  });

  afterEach(() => {
    global._mongoClientPromise = undefined;
  });

  test("POST /api/auth/login con credenciales correctas emite JWT y cookie HttpOnly", async () => {
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "ortiz@utm.edu.mx",
        password: "DocentePass123",
      }),
    });

    const response = await loginPOST(request);
    assert.equal(response.status, 200);

    const cookieHeader = response.headers.get("Set-Cookie");
    assert.ok(cookieHeader);
    assert.ok(cookieHeader.includes("utm_session="));
    assert.ok(cookieHeader.includes("HttpOnly"));

    const body = (await response.json()) as { data: { user: AuthUser; token: string } };
    assert.equal(body.data.user.id_usuario, "usr_doc_01");
    assert.equal(body.data.user.rol, "reportante");
    assert.equal(body.data.user.rol_institucional, "Docente");
    assert.ok(typeof body.data.token === "string");
  });

  test("POST /api/auth/login con contraseña incorrecta retorna HTTP 401", async () => {
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "ortiz@utm.edu.mx",
        password: "WrongPassword",
      }),
    });

    const response = await loginPOST(request);
    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("Credenciales inválidas"));
  });

  test("GET /api/auth/me con token Bearer válido retorna identidad del usuario", async () => {
    // 1. Iniciar sesión para obtener token
    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correo: "ortiz@utm.edu.mx",
        password: "DocentePass123",
      }),
    });
    const loginRes = await loginPOST(loginReq);
    const loginBody = (await loginRes.json()) as { data: { token: string } };

    // 2. Consultar /api/auth/me
    const meReq = new Request("http://localhost:3000/api/auth/me", {
      headers: {
        Authorization: `Bearer ${loginBody.data.token}`,
      },
    });

    const meRes = await meGET(meReq);
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as { data: { user: AuthUser } };
    assert.equal(meBody.data.user.id_usuario, "usr_doc_01");
  });

  test("POST /api/auth/logout limpia la cookie utm_session", async () => {
    const response = await logoutPOST();
    assert.equal(response.status, 200);
    const cookie = response.headers.get("Set-Cookie");
    assert.ok(cookie?.includes("Max-Age=0"));
  });
});
