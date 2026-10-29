import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Redis } from "@upstash/redis";
import type { MongoClient } from "mongodb";
import { POST } from "../app/api/incidencias/route";
import { createSessionToken, type AuthUser } from "../lib/auth";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("POST /api/incidencias - Integración y Persistencia Canónica", () => {
  const reportanteUser: AuthUser = {
    id_usuario: "usr_rep_10",
    nombre: "Ing. Roberto Salgado",
    correo: "rsalgado@utm.edu.mx",
    rol: "reportante",
    rol_institucional: "Docente",
    departamento: "Ingeniería de Software",
  };

  const directivaUser: AuthUser = {
    id_usuario: "usr_dir_01",
    nombre: "Dra. Arizmendi",
    correo: "directiva@utm.edu.mx",
    rol: "directiva",
    departamento: "Dirección",
  };

  const validComputoPayload = {
    titulo: "Falla general de red en Edificio 4",
    descripcion: "Se perdió conectividad con el switch de distribución del piso 2.",
    categoria: "computo_redes",
    prioridad: "alta",
    ubicacion: {
      edificio: "Edificio 4",
      piso: "2",
      aula_laboratorio: "Laboratorio de Redes",
    },
    reportante: {
      id_usuario: "usr_rep_10",
      nombre: "Ing. Roberto Salgado",
      rol: "Docente",
      correo: "rsalgado@utm.edu.mx",
    },
    detalle_especifico: {
      direccion_ip: "192.168.40.1",
      vlan: 40,
      puerto_uplink: "Te1/1/1",
      equipos_afectados: 24,
    },
  };

  let insertedDocs: Record<string, unknown>[] = [];
  let redisCounter = 100;

  beforeEach(() => {
    insertedDocs = [];
    redisCounter = 100;

    // Inyectar doble de prueba para Upstash Redis
    global._redisClientInstance = {
      incr: async () => {
        redisCounter += 1;
        return redisCounter;
      },
    } as unknown as Redis;

    const userDb: Record<string, Record<string, unknown>> = {
      [reportanteUser.id_usuario]: {
        id_usuario: reportanteUser.id_usuario,
        nombre: reportanteUser.nombre,
        correo: reportanteUser.correo,
        rol: reportanteUser.rol,
        rol_institucional: reportanteUser.rol_institucional,
        departamento: reportanteUser.departamento,
        activo: true,
      },
      usr_sin_rol_inst: {
        id_usuario: "usr_sin_rol_inst",
        nombre: "Usuario Sin Rol Inst",
        correo: "sinrol@utm.edu.mx",
        rol: "reportante",
        // rol_institucional ausente
        activo: true,
      },
      usr_rol_invalido: {
        id_usuario: "usr_rol_invalido",
        nombre: "Usuario Rol Invalido",
        correo: "invalido@utm.edu.mx",
        rol: "reportante",
        rol_institucional: "InvitadoExterno",
        activo: true,
      },
      usr_demoted: {
        id_usuario: "usr_demoted",
        nombre: "Usuario Degradado",
        correo: "demoted@utm.edu.mx",
        rol: "tecnico",
        rol_institucional: "Docente",
        activo: true,
      },
    };

    // Inyectar doble de prueba para MongoDB Atlas
    const mockDb = {
      databaseName: "utm_desk_db",
      collection: (colName: string) => {
        if (colName === "usuarios") {
          return {
            findOne: async (query: { id_usuario?: string; activo?: boolean }) => {
              const found = query.id_usuario ? userDb[query.id_usuario] : null;
              if (found && query.activo === true && found.activo === true) {
                return found;
              }
              return null;
            },
          };
        }

        return {
          insertOne: async (doc: Record<string, unknown>) => {
            insertedDocs.push(doc);
            return {
              acknowledged: true,
              insertedId: "65fabc1234567890abcdef01",
            };
          },
        };
      },
    };

    const mockClient = {
      db: () => mockDb,
      connect: async () => mockClient,
    };

    global._mongoClientPromise = Promise.resolve(mockClient as unknown as MongoClient);
  });

  afterEach(() => {
    global._redisClientInstance = undefined;
    global._mongoClientPromise = undefined;
  });

  test("Rechaza petición no autenticada con HTTP 401", async () => {
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("Autenticación requerida"));
    assert.equal(insertedDocs.length, 0);
  });

  test("Rechaza petición de usuario autenticado sin permiso incidencia:create con HTTP 403", async () => {
    const token = await createSessionToken(directivaUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 403);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("permisos"));
    assert.equal(insertedDocs.length, 0);
  });

  test("Rechaza body que no es JSON válido con HTTP 400", async () => {
    const token = await createSessionToken(reportanteUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "este no es un json",
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("JSON"));
    assert.equal(insertedDocs.length, 0);
  });

  test("Rechaza payload inválido según Zod con HTTP 400", async () => {
    const token = await createSessionToken(reportanteUser);
    const invalidPayload = {
      ...validComputoPayload,
      titulo: "Corto", // Menor a 10 caracteres
    };

    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(invalidPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string; detalles?: unknown };
    assert.ok(body.error.includes("contrato") || body.error.includes("esquema"));
    assert.equal(insertedDocs.length, 0);
  });

  test("Flujo exitoso: registra incidencia propia con su identidad canónica y retorna HTTP 201", async () => {
    const token = await createSessionToken(reportanteUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 201);
    const body = (await response.json()) as {
      data: {
        id: string;
        folio: string;
        estado: string;
        categoria: string;
        tags: string[];
      };
    };

    // Verificar respuesta formal para el cliente
    assert.equal(body.data.id, "65fabc1234567890abcdef01");
    assert.equal(body.data.folio, "INC-2026-0101");
    assert.equal(body.data.estado, "abierta");
    assert.equal(body.data.categoria, "computo_redes");
    assert.deepEqual(body.data.tags, []);

    // Verificar documento real persistido en MongoDB Atlas
    assert.equal(insertedDocs.length, 1);
    const saved = insertedDocs[0] as {
      folio: string;
      estado: string;
      horas_invertidas: number;
      fecha_creacion: unknown;
      reportante: { id_usuario: string; nombre: string; rol_institucional: string; correo: string };
      tags: string[];
      historial_seguimiento: Array<{ fecha: unknown; autor: string; estado_nuevo: string }>;
      detalle_especifico: { vlan: number; equipos_afectados: number };
    };
    assert.equal(saved.folio, "INC-2026-0101");
    assert.equal(saved.estado, "abierta");
    assert.equal(saved.horas_invertidas, 0);
    assert.ok(saved.fecha_creacion instanceof Date);
    assert.equal(saved.reportante.id_usuario, reportanteUser.id_usuario);
    assert.equal(saved.reportante.nombre, reportanteUser.nombre);
    assert.equal(saved.reportante.correo, reportanteUser.correo);
    assert.equal(saved.reportante.rol_institucional, "Docente");
    assert.deepEqual(saved.tags, []);
    assert.equal(saved.historial_seguimiento.length, 1);
    assert.equal(saved.historial_seguimiento[0].autor, reportanteUser.nombre);
    assert.ok(saved.historial_seguimiento[0].fecha instanceof Date);
    assert.equal(saved.detalle_especifico.vlan, 40);
    assert.equal(saved.detalle_especifico.equipos_afectados, 24);
  });

  test("Seguridad contra suplantación: si el cliente envía un reportante ajeno en el JSON, no se persiste la identidad falsa", async () => {
    const token = await createSessionToken(reportanteUser);
    const forgedPayload = {
      ...validComputoPayload,
      reportante: {
        id_usuario: "usr_rector_99",
        nombre: "Dr. Rector Suplantado",
        rol: "Administrativo",
        correo: "rector@utm.edu.mx",
      },
    };

    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(forgedPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 201);

    // Verificar que el documento persistido contiene la identidad canónica del usuario autenticado
    assert.equal(insertedDocs.length, 1);
    const saved = insertedDocs[0] as {
      reportante: { id_usuario: string; nombre: string; correo: string; rol_institucional: string };
      historial_seguimiento: Array<{ autor: string }>;
    };

    // La identidad persistida DEBE pertenecer a reportanteUser
    assert.equal(saved.reportante.id_usuario, "usr_rep_10");
    assert.equal(saved.reportante.nombre, "Ing. Roberto Salgado");
    assert.equal(saved.reportante.correo, "rsalgado@utm.edu.mx");
    assert.equal(saved.reportante.rol_institucional, "Docente");
    assert.equal(saved.historial_seguimiento[0].autor, "Ing. Roberto Salgado");

    // Y NO a la identidad enviada en el JSON
    assert.notEqual(saved.reportante.id_usuario, "usr_rector_99");
    assert.notEqual(saved.reportante.nombre, "Dr. Rector Suplantado");
    assert.notEqual(saved.reportante.correo, "rector@utm.edu.mx");
  });

  test("Seguridad: si la búsqueda del usuario canónico falla (inexistente o inactivo), no se persiste documento (HTTP 403)", async () => {
    // Usuario con token válido pero no registrado o dado de baja en la BD
    const ghostUser: AuthUser = {
      id_usuario: "usr_inexistente_999",
      nombre: "Fantasma",
      correo: "fantasma@utm.edu.mx",
      rol: "reportante",
      departamento: "Ninguno",
    };

    const token = await createSessionToken(ghostUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 403);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("usuario activo registrado"));

    // Comprobar que no se persistió absolutamente nada en MongoDB ni se incrementó Redis
    assert.equal(insertedDocs.length, 0);
    assert.equal(redisCounter, 100);
  });

  test("Seguridad: si el usuario canónico no tiene rol_institucional en MongoDB, se rechaza con HTTP 403 sin consumir folio ni insertar datos", async () => {
    const userSinRol: AuthUser = {
      id_usuario: "usr_sin_rol_inst",
      nombre: "Usuario Sin Rol Inst",
      correo: "sinrol@utm.edu.mx",
      rol: "reportante",
      departamento: "Sistemas",
    };

    const token = await createSessionToken(userSinRol);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 403);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("rol institucional no es válido") || body.error.includes("perfil del usuario es incompleto"));
    assert.equal(insertedDocs.length, 0);
    assert.equal(redisCounter, 100);
  });

  test("Seguridad: si el usuario canónico tiene un rol_institucional inválido en MongoDB, se rechaza con HTTP 403 sin consumir folio ni insertar datos", async () => {
    const userRolInvalido: AuthUser = {
      id_usuario: "usr_rol_invalido",
      nombre: "Usuario Rol Invalido",
      correo: "invalido@utm.edu.mx",
      rol: "reportante",
      departamento: "Sistemas",
    };

    const token = await createSessionToken(userRolInvalido);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 403);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("rol institucional no es válido") || body.error.includes("perfil del usuario es incompleto"));
    assert.equal(insertedDocs.length, 0);
    assert.equal(redisCounter, 100);
  });

  test("Seguridad: si el rol de sistema del usuario canónico en MongoDB no tiene permiso para crear incidencias, se rechaza con HTTP 403 sin consumir folio ni insertar datos", async () => {
    const userDemoted: AuthUser = {
      id_usuario: "usr_demoted",
      nombre: "Usuario Degradado",
      correo: "demoted@utm.edu.mx",
      rol: "reportante", // Token emitido cuando tenía rol reportante
      departamento: "Sistemas",
    };

    const token = await createSessionToken(userDemoted);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 403);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("permisos suficientes"));
    assert.equal(insertedDocs.length, 0);
    assert.equal(redisCounter, 100);
  });

  test("Manejo de fallo en Redis: retorna HTTP 503 sanitizado sin exponer secretos", async () => {
    // Simular error en Redis (ej. timeout o token caído)
    global._redisClientInstance = {
      incr: async () => {
        throw new Error("Connection failed to https://fake-redis.upstash.io with token AABBCCDDEEFF");
      },
    } as unknown as Redis;

    const token = await createSessionToken(reportanteUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.length > 0);
    // Verificar sanitización de URL de Upstash y credenciales
    assert.ok(!body.error.includes("fake-redis.upstash.io"));
    assert.equal(insertedDocs.length, 0);
  });

  test("Manejo de colisión de folio en MongoDB (código 11000): retorna HTTP 409", async () => {
    // Simular error de clave duplicada E11000 en MongoDB
    const mockDb = {
      databaseName: "utm_desk_db",
      collection: (colName: string) => {
        if (colName === "usuarios") {
          return {
            findOne: async () => ({
              id_usuario: reportanteUser.id_usuario,
              nombre: reportanteUser.nombre,
              correo: reportanteUser.correo,
              rol: reportanteUser.rol,
              rol_institucional: reportanteUser.rol_institucional,
              activo: true,
            }),
          };
        }
        return {
          insertOne: async () => {
            const err = new Error("E11000 duplicate key error collection: utm_desk_db.incidencias_campus index: folio_1 dup key: { folio: 'INC-2026-0101' }") as Error & { code?: number };
            err.code = 11000;
            throw err;
          },
        };
      },
    };
    global._mongoClientPromise = Promise.resolve({ db: () => mockDb, connect: async () => ({ db: () => mockDb }) } as unknown as MongoClient);

    const token = await createSessionToken(reportanteUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 409);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("Conflicto de unicidad"));
  });

  test("Manejo de violación $jsonSchema en MongoDB (código 121): retorna HTTP 400", async () => {
    const mockDb = {
      databaseName: "utm_desk_db",
      collection: (colName: string) => {
        if (colName === "usuarios") {
          return {
            findOne: async () => ({
              id_usuario: reportanteUser.id_usuario,
              nombre: reportanteUser.nombre,
              correo: reportanteUser.correo,
              rol: reportanteUser.rol,
              rol_institucional: reportanteUser.rol_institucional,
              activo: true,
            }),
          };
        }
        return {
          insertOne: async () => {
            const err = new Error("Document failed validation") as Error & { code?: number };
            err.code = 121;
            throw err;
          },
        };
      },
    };
    global._mongoClientPromise = Promise.resolve({ db: () => mockDb, connect: async () => ({ db: () => mockDb }) } as unknown as MongoClient);

    const token = await createSessionToken(reportanteUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.ok(body.error.includes("$jsonSchema"));
  });

  test("Manejo de indisponibilidad de MongoDB: retorna HTTP 503 sanitizado", async () => {
    const mockDb = {
      databaseName: "utm_desk_db",
      collection: () => ({
        findOne: async () => {
          throw new Error("MongoServerSelectionError: connection timed out connecting to mongodb+srv://db_admin:Secret123@cluster0.abcde.mongodb.net");
        },
        insertOne: async () => {
          throw new Error("MongoServerSelectionError: connection timed out connecting to mongodb+srv://db_admin:Secret123@cluster0.abcde.mongodb.net");
        },
      }),
    };
    global._mongoClientPromise = Promise.resolve({ db: () => mockDb, connect: async () => ({ db: () => mockDb }) } as unknown as MongoClient);

    const token = await createSessionToken(reportanteUser);
    const request = new Request("http://localhost:3000/api/incidencias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validComputoPayload),
    });

    const response = await POST(request);
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string };
    assert.ok(!body.error.includes("Secret123"));
    assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
  });
});
