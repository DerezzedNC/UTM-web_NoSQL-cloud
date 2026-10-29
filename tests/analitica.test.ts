import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { MongoClient } from "mongodb";
import { GET } from "../app/api/analitica/route";
import { createSessionToken, type AuthUser } from "../lib/auth";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("GET /api/analitica - Agregación y Persistencia en MongoDB Atlas", () => {
  const directivaUser: AuthUser = {
    id_usuario: "usr_dir_01",
    nombre: "Dra. Arizmendi",
    correo: "directiva@utm.edu.mx",
    rol: "directiva",
    departamento: "Dirección General",
  };

  const adminUser: AuthUser = {
    id_usuario: "usr_adm_01",
    nombre: "Administrador General",
    correo: "admin@utm.edu.mx",
    rol: "admin",
    departamento: "Dirección de TI",
  };

  const coordinadorUser: AuthUser = {
    id_usuario: "usr_coord_01",
    nombre: "Ing. Beatriz Paredes",
    correo: "coordinacion@utm.edu.mx",
    rol: "coordinador",
    departamento: "Coordinación de Tecnologías",
  };

  const tecnicoUser: AuthUser = {
    id_usuario: "usr_tec_01",
    nombre: "Carlos Mendoza",
    correo: "cmendoza@utm.edu.mx",
    rol: "tecnico",
    departamento: "Soporte Técnico",
  };

  const reportanteUser: AuthUser = {
    id_usuario: "usr_rep_10",
    nombre: "Ing. Roberto Salgado",
    correo: "rsalgado@utm.edu.mx",
    rol: "reportante",
    rol_institucional: "Docente",
    departamento: "Ingeniería de Software",
  };

  let mockDocs: Array<Record<string, unknown>> = [];
  let shouldFailMongo = false;
  let mongoFailMessage = "";

  const originalMongoPromise = global._mongoClientPromise;

  beforeEach(() => {
    mockDocs = [];
    shouldFailMongo = false;
    mongoFailMessage = "";

    const mockCollection = {
      findOne: async (query: { id_usuario?: string; activo?: boolean }) => {
        if (shouldFailMongo) {
          throw new Error(mongoFailMessage || "Error simulado en MongoDB");
        }
        if (query.id_usuario === "usr_dir_01") {
          return { id_usuario: "usr_dir_01", nombre: "Dra. Arizmendi", rol: "directiva", activo: true };
        }
        if (query.id_usuario === "usr_adm_01") {
          return { id_usuario: "usr_adm_01", nombre: "Administrador General", rol: "admin", activo: true };
        }
        if (query.id_usuario === "usr_coord_01") {
          return { id_usuario: "usr_coord_01", nombre: "Ing. Beatriz Paredes", rol: "coordinador", activo: true };
        }
        if (query.id_usuario === "usr_tec_01") {
          return { id_usuario: "usr_tec_01", nombre: "Carlos Mendoza", rol: "tecnico", activo: true };
        }
        if (query.id_usuario === "usr_rep_10") {
          return { id_usuario: "usr_rep_10", nombre: "Ing. Roberto Salgado", rol: "reportante", activo: true };
        }
        if (query.id_usuario === "usr_inactivo") {
          return null;
        }
        return null;
      },
      aggregate: (pipeline: Array<Record<string, unknown>>) => {
        if (shouldFailMongo) {
          throw new Error(mongoFailMessage || "Error simulado en MongoDB aggregate");
        }

        return {
          toArray: async () => {
            // Evaluar si es el pipeline de eficiencia o de tags
            const isEficiencia = pipeline.some(
              (stage) =>
                stage.$match &&
                typeof stage.$match === "object" &&
                "estado" in (stage.$match as Record<string, unknown>)
            );
            if (isEficiencia) {
              const resueltos = mockDocs.filter(
                (d) => d.estado === "resuelta" || d.estado === "cerrada"
              );
              const mapEdificios = new Map<string, { count: number; horas: number }>();
              for (const doc of resueltos) {
                const u = (doc.ubicacion ?? {}) as Record<string, unknown>;
                const edif = String(u.edificio || "Sin edificio");
                const curr = mapEdificios.get(edif) || { count: 0, horas: 0 };
                curr.count += 1;
                curr.horas += Number(doc.horas_invertidas || 0);
                mapEdificios.set(edif, curr);
              }
              const resultado = Array.from(mapEdificios.entries()).map(([edificio, data]) => ({
                _id: edificio,
                tickets_resueltos_cerrados: data.count,
                horas_totales: data.horas,
                promedio_horas: data.count ? data.horas / data.count : 0,
              }));
              resultado.sort((a, b) => b.tickets_resueltos_cerrados - a.tickets_resueltos_cerrados || b.horas_totales - a.horas_totales);
              return resultado;
            }

            const isTags = pipeline.some((stage) => "$unwind" in stage && stage.$unwind === "$tags");
            if (isTags) {
              const mapTags = new Map<string, number>();
              for (const doc of mockDocs) {
                const tags = Array.isArray(doc.tags) ? doc.tags : [];
                for (const t of tags) {
                  const tagStr = String(t);
                  mapTags.set(tagStr, (mapTags.get(tagStr) || 0) + 1);
                }
              }
              const resultado = Array.from(mapTags.entries()).map(([tag, freq]) => ({
                _id: tag,
                frecuencia: freq,
              }));
              resultado.sort((a, b) => b.frecuencia - a.frecuencia || a._id.localeCompare(b._id));
              return resultado.slice(0, 10);
            }

            return [];
          },
        };
      },
    };

    const mockDb = {
      collection: (name: string) => {
        if (name === "usuarios") return mockCollection;
        if (name === "incidencias_campus") return mockCollection;
        return mockCollection;
      },
    };

    const mockClient = {
      db: () => mockDb,
    } as unknown as MongoClient;

    global._mongoClientPromise = Promise.resolve(mockClient);
  });

  afterEach(() => {
    global._mongoClientPromise = originalMongoPromise;
  });

  // ==========================================================================
  // 1. AUTENTICACIÓN Y AUTORIZACIÓN
  // ==========================================================================
  test("1. Rechaza petición sin sesión con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/analitica");
    const res = await GET(req);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Autenticación requerida/i);
  });

  test("1. Rechaza petición con JWT manipulado con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/analitica", {
      headers: { authorization: "Bearer invalid.jwt.token" },
    });
    const res = await GET(req);
    assert.equal(res.status, 401);
  });

  test("2. Rechaza con HTTP 403 a usuarios con rol 'reportante'", async () => {
    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/analitica", {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /permisos suficientes/i);
  });

  test("2. Rechaza con HTTP 403 a usuarios con rol 'tecnico'", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/analitica", {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /permisos suficientes/i);
  });

  test("2. Rechaza con HTTP 403 a usuarios inactivos o inexistentes en MongoDB", async () => {
    const token = await createSessionToken({
      ...directivaUser,
      id_usuario: "usr_inactivo",
    });
    const req = new Request("http://localhost:3000/api/analitica", {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /usuario activo/i);
  });

  // ==========================================================================
  // 2. CONSULTA EXITOSA Y AGREGACIONES
  // ==========================================================================
  test("3. Permite a directiva, admin y coordinador consultar analítica con HTTP 200", async () => {
    mockDocs = [
      {
        estado: "resuelta",
        horas_invertidas: 3.5,
        ubicacion: { edificio: "Laboratorios de Cómputo" },
        tags: ["red", "switch"],
      },
      {
        estado: "cerrada",
        horas_invertidas: 2.0,
        ubicacion: { edificio: "Laboratorios de Cómputo" },
        tags: ["red", "cableado"],
      },
      {
        estado: "resuelta",
        horas_invertidas: 5.0,
        ubicacion: { edificio: "Edificio Central" },
        tags: ["energia"],
      },
      {
        estado: "abierta", // No debe sumarse en eficiencia de resueltos
        horas_invertidas: 1.0,
        ubicacion: { edificio: "Edificio Central" },
        tags: ["hardware"],
      },
    ];

    for (const user of [directivaUser, adminUser, coordinadorUser]) {
      const token = await createSessionToken(user);
      const req = new Request("http://localhost:3000/api/analitica", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        eficiencia_por_edificio: Array<{
          edificio: string;
          tickets_resueltos_cerrados: number;
          horas_totales: number;
          promedio_horas: number;
        }>;
        top_tags: Array<{ tag: string; frecuencia: number }>;
      };

      // Eficiencia
      assert.equal(body.eficiencia_por_edificio.length, 2);
      const computo = body.eficiencia_por_edificio.find((e) => e.edificio === "Laboratorios de Cómputo");
      assert.ok(computo);
      assert.equal(computo.tickets_resueltos_cerrados, 2);
      assert.equal(computo.horas_totales, 5.5);
      assert.equal(computo.promedio_horas, 2.75);

      const central = body.eficiencia_por_edificio.find((e) => e.edificio === "Edificio Central");
      assert.ok(central);
      assert.equal(central.tickets_resueltos_cerrados, 1);
      assert.equal(central.horas_totales, 5.0);

      // Top tags
      const tagRed = body.top_tags.find((t) => t.tag === "red");
      assert.ok(tagRed);
      assert.equal(tagRed.frecuencia, 2);
    }
  });

  test("4. Maneja colección vacía sin errores y retorna arreglos vacíos", async () => {
    mockDocs = [];

    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/analitica", {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      eficiencia_por_edificio: unknown[];
      top_tags: unknown[];
    };
    assert.deepEqual(body.eficiencia_por_edificio, []);
    assert.deepEqual(body.top_tags, []);
  });

  test("5. Sanitiza credenciales y cadenas sensibles cuando MongoDB Atlas falla (HTTP 503)", async () => {
    shouldFailMongo = true;
    mongoFailMessage = "MongoServerError: connection to mongodb+srv://super_admin:MySuperPassword123@cluster0.abc.mongodb.net failed";

    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/analitica", {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.ok(!body.error.includes("MySuperPassword123"));
    assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
  });
});
