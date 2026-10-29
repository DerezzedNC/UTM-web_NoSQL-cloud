import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { MongoClient } from "mongodb";
import { GET } from "../app/api/incidencias/buscar/route";
import { createSessionToken, type AuthUser } from "../lib/auth";
import type { FrontendRole } from "../lib/rbac";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("GET /api/incidencias/buscar - Migración y Persistencia en MongoDB Atlas", () => {
  const reportanteUser: AuthUser = {
    id_usuario: "usr_rep_10",
    nombre: "Ing. Roberto Salgado",
    correo: "rsalgado@utm.edu.mx",
    rol: "reportante",
    rol_institucional: "Docente",
    departamento: "Ingeniería de Software",
  };

  const tecnicoUser: AuthUser = {
    id_usuario: "usr_tec_01",
    nombre: "Carlos Mendoza",
    correo: "cmendoza@utm.edu.mx",
    rol: "tecnico",
    area_asignada: "computo_redes",
    departamento: "Soporte Técnico",
  };

  const coordinadorUser: AuthUser = {
    id_usuario: "usr_coord_01",
    nombre: "Ing. Beatriz Paredes",
    correo: "coordinacion@utm.edu.mx",
    rol: "coordinador",
    departamento: "Coordinación de Tecnologías",
  };

  const adminUser: AuthUser = {
    id_usuario: "usr_adm_01",
    nombre: "Administrador General",
    correo: "admin@utm.edu.mx",
    rol: "admin",
    departamento: "Dirección de TI",
  };

  const directivaUser: AuthUser = {
    id_usuario: "usr_dir_01",
    nombre: "Dra. Arizmendi",
    correo: "directiva@utm.edu.mx",
    rol: "directiva",
    departamento: "Dirección",
  };

  const unauthorizedUser: AuthUser = {
    id_usuario: "usr_hacker_01",
    nombre: "Usuario Desconocido",
    correo: "fake@external.com",
    rol: "invitado_externo" as unknown as FrontendRole,
    departamento: "Externo",
  };

  let mockDocs: Record<string, unknown>[] = [];
  let shouldFailMongo = false;
  let mongoFailMessage = "";
  let simulateMissingTextIndex = false;
  let simulateNetworkErrorDuringText = false;
  let fallbackOrQueryExecuted = false;

  function sampleIncidencia(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      _id: "65fabc1234567890abcdef01",
      folio: "INC-2026-0101",
      titulo: "Falla de conectividad switch sala A",
      descripcion: "El switch del rack principal no responde pings ni tráfico vlan.",
      prioridad: "alta",
      categoria: "computo_redes",
      estado: "abierta",
      horas_invertidas: 0,
      fecha_creacion: new Date("2026-10-25T10:00:00.000Z"),
      ubicacion: {
        edificio: "Edificio 4",
        piso: "2",
        aula_laboratorio: "Laboratorio A",
      },
      reportante: {
        id_usuario: "usr_rep_10",
        nombre: "Ing. Roberto Salgado",
        rol_institucional: "Docente",
        correo: "rsalgado@utm.edu.mx",
      },
      detalle_especifico: {
        direccion_ip: "192.168.40.1",
        vlan: 40,
        puerto_uplink: "Te1/1/1",
        equipos_afectados: 15,
      },
      tags: ["redes", "switch"],
      historial_seguimiento: [
        {
          fecha: new Date("2026-10-25T10:00:00.000Z"),
          autor: "Ing. Roberto Salgado",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Apertura de incidencia inicial",
        },
      ],
      evidencias_adjuntas: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    mockDocs = [];
    shouldFailMongo = false;
    mongoFailMessage = "";
    simulateMissingTextIndex = false;
    simulateNetworkErrorDuringText = false;
    fallbackOrQueryExecuted = false;

    const hasTextQuery = (filter: Record<string, unknown>): boolean => {
      if (!filter || typeof filter !== "object") return false;
      if (filter.$text) return true;
      if (Array.isArray(filter.$and)) {
        return filter.$and.some((c) => Boolean(c && typeof c === "object" && hasTextQuery(c as Record<string, unknown>)));
      }
      return false;
    };

    const matchSingleCondition = (doc: Record<string, unknown>, cond: Record<string, unknown>): boolean => {
      if (cond.$and && Array.isArray(cond.$and)) {
        return cond.$and.every((sub) => matchSingleCondition(doc, sub as Record<string, unknown>));
      }
      if (cond.$or && Array.isArray(cond.$or)) {
        const isTextFallback = cond.$or.some((c: Record<string, unknown>) => c.titulo || c.descripcion);
        if (isTextFallback) {
          fallbackOrQueryExecuted = true;
        }
        return cond.$or.some((sub) => matchSingleCondition(doc, sub as Record<string, unknown>));
      }
      if (cond.categoria && doc.categoria !== cond.categoria) {
        return false;
      }
      if (cond.estado && doc.estado !== cond.estado) {
        return false;
      }
      if (cond["ubicacion.edificio"]) {
        const regexObj = cond["ubicacion.edificio"] as { $regex?: string; $options?: string };
        const u = (doc.ubicacion ?? {}) as Record<string, string>;
        const edif = u.edificio ?? "";
        if (regexObj.$regex) {
          const re = new RegExp(regexObj.$regex, regexObj.$options ?? "");
          if (!re.test(edif)) return false;
        }
      }
      if (cond["reportante.id_usuario"]) {
        const rep = (doc.reportante ?? {}) as Record<string, string>;
        if (rep.id_usuario !== cond["reportante.id_usuario"]) return false;
      }
      if (cond["reportante.correo"]) {
        const rep = (doc.reportante ?? {}) as Record<string, string>;
        if (String(rep.correo ?? "").toLowerCase() !== String(cond["reportante.correo"]).toLowerCase()) return false;
      }
      if (cond["tecnico_asignado.id_usuario"]) {
        const tec = (doc.tecnico_asignado ?? {}) as Record<string, string>;
        if (tec.id_usuario !== cond["tecnico_asignado.id_usuario"]) return false;
      }
      if (cond["tecnico_asignado.correo"]) {
        const tec = (doc.tecnico_asignado ?? {}) as Record<string, string>;
        if (String(tec.correo ?? "").toLowerCase() !== String(cond["tecnico_asignado.correo"]).toLowerCase()) return false;
      }
      if (cond.titulo) {
        if (typeof cond.titulo === "object" && cond.titulo !== null && "$regex" in cond.titulo) {
          const regexObj = cond.titulo as { $regex?: string; $options?: string };
          const re = new RegExp(regexObj.$regex ?? "", regexObj.$options ?? "");
          if (!re.test(String(doc.titulo ?? ""))) return false;
        } else if (doc.titulo !== cond.titulo) {
          return false;
        }
      }
      if (cond.descripcion) {
        if (typeof cond.descripcion === "object" && cond.descripcion !== null && "$regex" in cond.descripcion) {
          const regexObj = cond.descripcion as { $regex?: string; $options?: string };
          const re = new RegExp(regexObj.$regex ?? "", regexObj.$options ?? "");
          if (!re.test(String(doc.descripcion ?? ""))) return false;
        } else if (doc.descripcion !== cond.descripcion) {
          return false;
        }
      }
      if (cond.$text) {
        const search = String((cond.$text as { $search: string }).$search).toLowerCase();
        const titulo = String(doc.titulo ?? "").toLowerCase();
        const desc = String(doc.descripcion ?? "").toLowerCase();
        if (!titulo.includes(search) && !desc.includes(search)) {
          return false;
        }
      }
      return true;
    };

    const filterCollection = (filter: Record<string, unknown>) => {
      return mockDocs.filter((doc) => matchSingleCondition(doc, filter));
    };

    const mockDb = {
      databaseName: "utm_desk_db",
      collection: (colName: string) => {
        if (colName !== "incidencias_campus") {
          throw new Error(`Colección desconocida: ${colName}`);
        }

        return {
          countDocuments: async (filter: Record<string, unknown> = {}) => {
            if (shouldFailMongo) {
              throw new Error(mongoFailMessage || "Error simulado en countDocuments");
            }
            if (hasTextQuery(filter) && simulateMissingTextIndex) {
              const err = new Error("text index required for $text query");
              Object.assign(err, { code: 27, codeName: "IndexNotFound" });
              throw err;
            }
            if (hasTextQuery(filter) && simulateNetworkErrorDuringText) {
              throw new Error(
                "MongoNetworkError: failed to connect to mongodb+srv://admin_usr:SecretPass123@cluster0.utm.mongodb.net/utm_desk_db"
              );
            }
            return filterCollection(filter).length;
          },
          find: (filter: Record<string, unknown> = {}) => {
            if (hasTextQuery(filter) && simulateMissingTextIndex) {
              const err = new Error("text index required for $text query");
              Object.assign(err, { code: 27, codeName: "IndexNotFound" });
              throw err;
            }
            if (hasTextQuery(filter) && simulateNetworkErrorDuringText) {
              throw new Error(
                "MongoNetworkError: failed to connect to mongodb+srv://admin_usr:SecretPass123@cluster0.utm.mongodb.net/utm_desk_db"
              );
            }
            return {
              sort: () => ({
                skip: (skipN: number) => ({
                  limit: (limitM: number) => ({
                    toArray: async () => {
                      if (shouldFailMongo) {
                        throw new Error(mongoFailMessage || "Error simulado en toArray");
                      }
                      const filtered = filterCollection(filter);
                      // Ordenar por fecha_creacion desc y _id desc
                      filtered.sort((a, b) => {
                        const dateA = a.fecha_creacion instanceof Date ? a.fecha_creacion.getTime() : new Date(String(a.fecha_creacion)).getTime();
                        const dateB = b.fecha_creacion instanceof Date ? b.fecha_creacion.getTime() : new Date(String(b.fecha_creacion)).getTime();
                        if (dateB !== dateA) return dateB - dateA;
                        return String(b._id).localeCompare(String(a._id));
                      });
                      return filtered.slice(skipN, skipN + limitM);
                    },
                  }),
                }),
              }),
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
    delete global._mongoClientPromise;
  });

  // ==========================================================================
  // 1. SOLICITUDES SIN SESIÓN VÁLIDA (HTTP 401)
  // ==========================================================================
  test("1. Rechaza solicitudes sin cabecera Authorization ni cookie con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      method: "GET",
    });

    const res = await GET(req);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Autenticación requerida/i);
  });

  test("1. Rechaza solicitudes con token Bearer manipulado o corrupto con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      method: "GET",
      headers: {
        authorization: "Bearer token_completamente_invalido_y_malformado",
      },
    });

    const res = await GET(req);
    assert.equal(res.status, 401);
  });

  // ==========================================================================
  // 2. ACCESO PERMITIDO Y DENEGADO SEGÚN REGLAS RBAC (403 vs 200)
  // ==========================================================================
  test("2. Permite acceso a usuarios con roles autorizados (reportante, tecnico, directiva)", async () => {
    const repToken = await createSessionToken(reportanteUser);
    const tecToken = await createSessionToken(tecnicoUser);
    const dirToken = await createSessionToken(directivaUser);

    for (const token of [repToken, tecToken, dirToken]) {
      const req = new Request("http://localhost:3000/api/incidencias/buscar", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200, `El rol debería tener acceso a incidencia:read`);
    }
  });

  test("2. Deniega acceso con HTTP 403 a roles sin permiso 'incidencia:read'", async () => {
    const unauthJwt = await createSessionToken(unauthorizedUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${unauthJwt}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /No tienes permisos suficientes/i);
  });

  // ==========================================================================
  // 3. RESPUESTA CORRECTA CON RESULTADOS DE MONGODB
  // ==========================================================================
  test("3. Retorna array de incidencias formateadas y metadatos de paginación", async () => {
    mockDocs = [
      sampleIncidencia({
        _id: "65fabc1234567890abcdef01",
        folio: "INC-2026-0001",
        titulo: "Falla de red en laboratorio",
      }),
    ];

    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
      pagination: { total: number; page: number; limit: number; totalPages: number };
    };

    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
    assert.equal(body.pagination.total, 1);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 50);
    assert.equal(body.pagination.totalPages, 1);

    const item = body.data[0];
    assert.equal(item._id, "65fabc1234567890abcdef01");
    assert.equal(item.folio, "INC-2026-0001");
    assert.equal(item.titulo, "Falla de red en laboratorio");
    assert.equal(typeof item.fecha_creacion, "string");
    assert.ok(item.reportante && typeof item.reportante === "object");
    assert.ok(item.ubicacion && typeof item.ubicacion === "object");
  });

  // ==========================================================================
  // 4. FILTROS VÁLIDOS Y PARÁMETROS INVÁLIDOS
  // ==========================================================================
  test("4. Filtra correctamente por categoría, estado, edificio y texto", async () => {
    mockDocs = [
      sampleIncidencia({
        _id: "1",
        folio: "INC-2026-0001",
        categoria: "computo_redes",
        estado: "abierta",
        titulo: "Switch dañado",
        descripcion: "El switch del rack principal no responde tráfico de red.",
        ubicacion: { edificio: "Edificio 4", piso: "1", aula_laboratorio: "L1" },
      }),
      sampleIncidencia({
        _id: "2",
        folio: "INC-2026-0002",
        categoria: "infraestructura",
        estado: "en_proceso",
        titulo: "Fuga de agua en tubería",
        descripcion: "Fuga de agua en los sanitarios principales de la planta baja.",
        ubicacion: { edificio: "Edificio 2", piso: "1", aula_laboratorio: "Sanitarios" },
      }),
      sampleIncidencia({
        _id: "3",
        folio: "INC-2026-0003",
        categoria: "academico",
        estado: "resuelta",
        titulo: "Error en plataforma Moodle",
        descripcion: "Los estudiantes reportan error al subir tareas a la plataforma virtual.",
        ubicacion: { edificio: "Edificio Central", piso: "3", aula_laboratorio: "A3" },
      }),
    ];

    const token = await createSessionToken(directivaUser);

    // Filtro categoria
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?categoria=infraestructura", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      const body = (await res.json()) as { data: Array<{ categoria: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].categoria, "infraestructura");
    }

    // Filtro estado con normalización ("en proceso" -> "en_proceso")
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?estado=en%20proceso", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      const body = (await res.json()) as { data: Array<{ estado: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].estado, "en_proceso");
    }

    // Filtro edificio
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?edificio=Edificio%20Central", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].folio, "INC-2026-0003");
    }

    // Filtro de texto `q`
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?q=switch", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].folio, "INC-2026-0001");
    }
  });

  test("4. Rechaza parámetros inválidos con HTTP 400 y detalles claros", async () => {
    const token = await createSessionToken(reportanteUser);

    // Categoría inválida
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?categoria=categoria_falsa", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.match(body.error, /Parámetros de búsqueda inválidos/i);
    }

    // Estado inválido
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?estado=destruido", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 400);
    }

    // Página no positiva
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?page=0", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 400);
    }

    // Límite fuera de rango (máximo 100)
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?limit=500", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 400);
    }

    // Término de búsqueda excesivo (> 100 caracteres)
    {
      const longTerm = "a".repeat(101);
      const req = new Request(`http://localhost:3000/api/incidencias/buscar?q=${longTerm}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 400);
    }
  });

  // ==========================================================================
  // 5. PAGINACIÓN Y ORDENACIÓN ESTABLE
  // ==========================================================================
  test("5. Aplica paginación y ordenación determinista por fecha y _id", async () => {
    mockDocs = [
      sampleIncidencia({
        _id: "01",
        folio: "INC-2026-0001",
        fecha_creacion: new Date("2026-10-01T10:00:00Z"),
      }),
      sampleIncidencia({
        _id: "02",
        folio: "INC-2026-0002",
        fecha_creacion: new Date("2026-10-02T10:00:00Z"),
      }),
      sampleIncidencia({
        _id: "03",
        folio: "INC-2026-0003",
        fecha_creacion: new Date("2026-10-03T10:00:00Z"),
      }),
      sampleIncidencia({
        _id: "04",
        folio: "INC-2026-0004",
        fecha_creacion: new Date("2026-10-04T10:00:00Z"),
      }),
      sampleIncidencia({
        _id: "05",
        folio: "INC-2026-0005",
        fecha_creacion: new Date("2026-10-05T10:00:00Z"),
      }),
    ];

    const token = await createSessionToken(directivaUser);

    // Página 1, límite 2 -> debería devolver los más recientes (05 y 04)
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?page=1&limit=2", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        data: Array<{ folio: string }>;
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
      assert.equal(body.data.length, 2);
      assert.equal(body.data[0].folio, "INC-2026-0005");
      assert.equal(body.data[1].folio, "INC-2026-0004");
      assert.equal(body.pagination.total, 5);
      assert.equal(body.pagination.page, 1);
      assert.equal(body.pagination.limit, 2);
      assert.equal(body.pagination.totalPages, 3);
    }

    // Página 2, límite 2 -> debería devolver los siguientes (03 y 02)
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?page=2&limit=2", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      assert.equal(body.data.length, 2);
      assert.equal(body.data[0].folio, "INC-2026-0003");
      assert.equal(body.data[1].folio, "INC-2026-0002");
    }

    // Página 3, límite 2 -> debería devolver el último restante (01)
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?page=3&limit=2", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].folio, "INC-2026-0001");
    }
  });

  // ==========================================================================
  // 6. COLECCIÓN VACÍA
  // ==========================================================================
  test("6. Retorna lista vacía y paginación con total=0 cuando no hay incidencias", async () => {
    mockDocs = [];
    const token = await createSessionToken(tecnicoUser);

    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      data: Array<unknown>;
      pagination: { total: number; page: number; limit: number; totalPages: number };
    };

    assert.deepEqual(body.data, []);
    assert.equal(body.pagination.total, 0);
    assert.equal(body.pagination.totalPages, 0);
  });

  // ==========================================================================
  // 7. ERRORES DE MONGODB CON RESPUESTA SANITIZADA (HTTP 503)
  // ==========================================================================
  test("7. Sanitiza credenciales y cadenas sensibles cuando MongoDB Atlas falla", async () => {
    shouldFailMongo = true;
    mongoFailMessage =
      "MongoServerSelectionError: connect ECONNREFUSED mongodb+srv://admin_usr:TopSecretPassword123@atlas-cluster.utm.mongodb.net/utm_desk_db";

    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 503);

    const body = (await res.json()) as { error: string };
    assert.ok(body.error);
    // Verificar que la contraseña y credenciales fueron reemplazadas
    assert.equal(body.error.includes("TopSecretPassword123"), false);
    assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
  });

  // ==========================================================================
  // 8. CONFIRMACIÓN DE QUE EL ENDPOINT NO DEPENDE DE LOS DATOS SIMULADOS
  // ==========================================================================
  test("8. Confirma que la respuesta proviene de MongoDB y no de INCIDENCIAS_INICIALES", async () => {
    // Registro exclusivo en MongoDB, inexistente en datos simulados de mock-data.ts
    const exclusiveMongoFolio = "INC-2026-9999";
    const exclusiveMongoTitle = "Incidencia Exclusiva Generada en Base de Datos Real";

    mockDocs = [
      sampleIncidencia({
        _id: "mongo_unique_id_9999",
        folio: exclusiveMongoFolio,
        titulo: exclusiveMongoTitle,
        categoria: "computo_redes",
      }),
    ];

    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = (await res.json()) as { data: Array<{ folio: string; titulo: string }> };

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].folio, exclusiveMongoFolio);
    assert.equal(body.data[0].titulo, exclusiveMongoTitle);

    // Verificar que los datos iniciales de mock-data.ts ("INC-2026-0001", "INC-2026-0002", etc.) no están
    const initialFolios = ["INC-2026-0001", "INC-2026-0002", "INC-2026-0003"];
    for (const fol of initialFolios) {
      assert.ok(!body.data.some((d) => d.folio === fol));
    }
  });

  // ==========================================================================
  // 9. FALLBACK DE BÚSQUEDA Y DISCRIMINACIÓN DE ERRORES DE MONGODB
  // ==========================================================================
  test("9. Ejecuta fallback de $text a $or estructurado cuando MongoDB reporta falta de índice de texto", async () => {
    simulateMissingTextIndex = true;
    fallbackOrQueryExecuted = false;

    mockDocs = [
      sampleIncidencia({
        _id: "mongo_fallback_01",
        folio: "INC-2026-4444",
        titulo: "Falla crítica en switch de distribución",
        descripcion: "El rack principal de redes se encuentra fuera de servicio.",
        categoria: "computo_redes",
      }),
      sampleIncidencia({
        _id: "mongo_fallback_02",
        folio: "INC-2026-4445",
        titulo: "Gotera en aula magna",
        descripcion: "Filtración de agua en el techo del auditorio.",
        categoria: "infraestructura",
      }),
    ];

    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar?q=switch", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = (await res.json()) as { data: Array<{ folio: string; titulo: string }> };
    assert.equal(fallbackOrQueryExecuted, true, "El fallback de $or con expresiones regulares debió ejecutarse");
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].folio, "INC-2026-4444");
  });

  test("9. No convierte errores de conexión en fallback; responde HTTP 503 sanitizado", async () => {
    simulateNetworkErrorDuringText = true;
    fallbackOrQueryExecuted = false;

    mockDocs = [
      sampleIncidencia({
        _id: "mongo_test_doc",
        titulo: "Switch en laboratorio",
        descripcion: "Conectividad intermitente",
      }),
    ];

    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar?q=switch", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 503);
    assert.equal(fallbackOrQueryExecuted, false, "Los errores de conexión no deben activar el fallback");

    const body = (await res.json()) as { error: string };
    assert.ok(body.error);
    assert.equal(body.error.includes("SecretPass123"), false);
    assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
  });

  test("9. Escapa correctamente caracteres especiales de regex en 'q' y evita inyección", async () => {
    simulateMissingTextIndex = true; // Activar fallback para evaluar escapeRegex en $or

    mockDocs = [
      sampleIncidencia({
        _id: "mongo_regex_literal",
        folio: "INC-2026-5555",
        titulo: "Error con [switch]+ y regexp*.",
        descripcion: "Falla con caracteres especiales en el rack.",
      }),
      sampleIncidencia({
        _id: "mongo_regex_other",
        folio: "INC-2026-5556",
        titulo: "Switch normal sin caracteres",
        descripcion: "Operando adecuadamente.",
      }),
    ];

    const token = await createSessionToken(directivaUser);

    // Buscar con caracteres especiales regex literales
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?q=%5Bswitch%5D%2B", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].folio, "INC-2026-5555");
    }

    // Comprobar que no actúa como comodín regex ".*" que coincida con todo
    {
      const req = new Request("http://localhost:3000/api/incidencias/buscar?q=.%2A", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      // Ningún documento tiene literalmente ".*" en título o descripción
      assert.equal(body.data.length, 0);
    }
  });

  // ==========================================================================
  // 10. SCOPING POR ROL EN SERVIDOR Y MITIGACIÓN DE BYPASS POR QUERY STRINGS
  // ==========================================================================
  test("10. Reportante solo puede consultar incidencias reportadas por él mismo", async () => {
    mockDocs = [
      sampleIncidencia({
        _id: "doc_propio",
        folio: "INC-2026-OWN",
        reportante: {
          id_usuario: "usr_rep_10",
          nombre: "Ing. Roberto Salgado",
          correo: "rsalgado@utm.edu.mx",
        },
      }),
      sampleIncidencia({
        _id: "doc_ajeno",
        folio: "INC-2026-OTHER",
        reportante: {
          id_usuario: "usr_rep_99",
          nombre: "Otro Reportante",
          correo: "otro@utm.edu.mx",
        },
      }),
    ];

    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Array<{ folio: string }> };
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].folio, "INC-2026-OWN");
  });

  test("10. Técnico solo puede consultar incidencias asignadas a él", async () => {
    mockDocs = [
      sampleIncidencia({
        _id: "doc_asignado",
        folio: "INC-2026-ASG",
        tecnico_asignado: {
          id_usuario: "usr_tec_01",
          nombre: "Carlos Mendoza",
          correo: "cmendoza@utm.edu.mx",
        },
      }),
      sampleIncidencia({
        _id: "doc_otro_tecnico",
        folio: "INC-2026-OTHER-TEC",
        tecnico_asignado: {
          id_usuario: "usr_tec_99",
          nombre: "Otro Técnico",
          correo: "otro_tec@utm.edu.mx",
        },
      }),
      sampleIncidencia({
        _id: "doc_sin_asignar",
        folio: "INC-2026-UNASG",
      }),
    ];

    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/buscar", {
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Array<{ folio: string }> };
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].folio, "INC-2026-ASG");
  });

  test("10. Coordinador, administrador y directiva pueden consultar todo el conjunto autorizado", async () => {
    mockDocs = [
      sampleIncidencia({ _id: "doc_1", folio: "INC-2026-0001" }),
      sampleIncidencia({ _id: "doc_2", folio: "INC-2026-0002" }),
    ];

    for (const user of [coordinadorUser, adminUser, directivaUser]) {
      const token = await createSessionToken(user);
      const req = new Request("http://localhost:3000/api/incidencias/buscar", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: Array<{ folio: string }> };
      assert.equal(body.data.length, 2);
    }
  });

  test("10. Parámetros rol, id_usuario y correo en query string son ignorados y no omiten restricción de propiedad", async () => {
    mockDocs = [
      sampleIncidencia({
        _id: "doc_propio",
        folio: "INC-2026-OWN",
        reportante: {
          id_usuario: "usr_rep_10",
          nombre: "Ing. Roberto Salgado",
          correo: "rsalgado@utm.edu.mx",
        },
      }),
      sampleIncidencia({
        _id: "doc_ajeno",
        folio: "INC-2026-OTHER",
        reportante: {
          id_usuario: "usr_rep_99",
          nombre: "Otro Reportante",
          correo: "otro@utm.edu.mx",
        },
      }),
    ];

    const token = await createSessionToken(reportanteUser);
    // Intento de manipulación de query params para elevarse a admin y ver todo o suplantar id_usuario
    const req = new Request(
      "http://localhost:3000/api/incidencias/buscar?rol=admin&id_usuario=usr_rep_99&correo=otro@utm.edu.mx",
      {
        headers: { authorization: `Bearer ${token}` },
      }
    );

    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Array<{ folio: string }> };
    // A pesar de ?rol=admin, el servidor aplica el rol real de la sesión (reportante) y solo devuelve la suya
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].folio, "INC-2026-OWN");
  });
});
