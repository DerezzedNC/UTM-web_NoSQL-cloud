import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ObjectId, type MongoClient } from "mongodb";
import { PATCH } from "../app/api/incidencias/[id]/tags/route";
import { createSessionToken, type AuthUser } from "../lib/auth";
import { INCIDENCIAS_INICIALES } from "../lib/incidencias/mock-data";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("PATCH /api/incidencias/[id]/tags - Migración segura a MongoDB Atlas", () => {
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

  let mockDbStorage: Map<string, Record<string, unknown>> = new Map();
  let shouldFailMongo = false;
  let mongoFailMessage = "";

  function sampleIncidencia(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      _id: "65fabc1234567890abcdef01",
      folio: "INC-2026-0001",
      titulo: "Falla de conectividad switch sala A",
      descripcion: "El switch del rack principal no responde tráfico de red.",
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
      historial_seguimiento: [],
      evidencias_adjuntas: [],
      ...overrides,
    };
  }

  function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    if (filter.$or && Array.isArray(filter.$or)) {
      const orMatches = filter.$or.some((subFilter) =>
        matchesFilter(doc, subFilter as Record<string, unknown>)
      );
      if (!orMatches) return false;
    }
    for (const key of Object.keys(filter)) {
      if (key === "$or") continue;
      const expected = filter[key];
      const actual = doc[key];
      if (expected instanceof ObjectId) {
        if (String(actual) !== String(expected)) return false;
      } else if (typeof expected === "object" && expected !== null) {
        if (String(actual) !== String(expected)) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
    return true;
  }

  let userDb: Record<string, Record<string, unknown>> = {};

  beforeEach(() => {
    mockDbStorage = new Map();
    shouldFailMongo = false;
    mongoFailMessage = "";

    userDb = {
      [tecnicoUser.id_usuario]: {
        id_usuario: tecnicoUser.id_usuario,
        nombre: tecnicoUser.nombre,
        correo: tecnicoUser.correo,
        rol: tecnicoUser.rol,
        activo: true,
      },
      [coordinadorUser.id_usuario]: {
        id_usuario: coordinadorUser.id_usuario,
        nombre: coordinadorUser.nombre,
        correo: coordinadorUser.correo,
        rol: coordinadorUser.rol,
        activo: true,
      },
      [adminUser.id_usuario]: {
        id_usuario: adminUser.id_usuario,
        nombre: adminUser.nombre,
        correo: adminUser.correo,
        rol: adminUser.rol,
        activo: true,
      },
      [reportanteUser.id_usuario]: {
        id_usuario: reportanteUser.id_usuario,
        nombre: reportanteUser.nombre,
        correo: reportanteUser.correo,
        rol: reportanteUser.rol,
        activo: true,
      },
      [directivaUser.id_usuario]: {
        id_usuario: directivaUser.id_usuario,
        nombre: directivaUser.nombre,
        correo: directivaUser.correo,
        rol: directivaUser.rol,
        activo: true,
      },
      usr_deactivated: {
        id_usuario: "usr_deactivated",
        nombre: "Técnico Desactivado",
        correo: "desactivado@utm.edu.mx",
        rol: "tecnico",
        activo: false,
      },
      usr_demoted_to_rep: {
        id_usuario: "usr_demoted_to_rep",
        nombre: "Técnico Degradado",
        correo: "degradado@utm.edu.mx",
        rol: "reportante",
        activo: true,
      },
    };

    const base = sampleIncidencia();
    mockDbStorage.set(String(base._id), base);

    const mockDb = {
      databaseName: "utm_desk_db",
      collection: (colName: string) => {
        if (colName === "usuarios") {
          return {
            findOne: async (filter: { id_usuario?: string; activo?: boolean }) => {
              if (shouldFailMongo) {
                throw new Error(mongoFailMessage || "Error simulado en usuarios findOne");
              }
              const user = filter.id_usuario ? userDb[filter.id_usuario] : null;
              if (user && (filter.activo === undefined || user.activo === filter.activo)) {
                return JSON.parse(JSON.stringify(user));
              }
              return null;
            },
          };
        }

        if (colName !== "incidencias_campus") {
          throw new Error(`Colección desconocida: ${colName}`);
        }

        return {
          findOne: async (filter: Record<string, unknown>) => {
            if (shouldFailMongo) {
              throw new Error(mongoFailMessage || "Error simulado en findOne");
            }
            for (const doc of mockDbStorage.values()) {
              if (matchesFilter(doc, filter)) {
                return JSON.parse(JSON.stringify(doc));
              }
            }
            return null;
          },
          findOneAndUpdate: async (
            filter: Record<string, unknown>,
            update: Record<string, unknown>
          ) => {
            if (shouldFailMongo) {
              throw new Error(mongoFailMessage || "Error simulado en findOneAndUpdate");
            }

            let targetDoc: Record<string, unknown> | null = null;
            let targetKey: string | null = null;

            for (const [key, doc] of mockDbStorage.entries()) {
              if (matchesFilter(doc, filter)) {
                targetDoc = doc;
                targetKey = key;
                break;
              }
            }

            if (!targetDoc || !targetKey) {
              return null;
            }

            // Aplicar $addToSet
            if (update.$addToSet && typeof update.$addToSet === "object") {
              const addToSetObj = update.$addToSet as Record<string, unknown>;
              for (const field of Object.keys(addToSetObj)) {
                if (!Array.isArray(targetDoc[field])) {
                  targetDoc[field] = [];
                }
                const arr = targetDoc[field] as unknown[];
                const val = addToSetObj[field];
                if (!arr.includes(val)) {
                  arr.push(val);
                }
              }
            }

            // Aplicar $pull
            if (update.$pull && typeof update.$pull === "object") {
              const pullObj = update.$pull as Record<string, unknown>;
              for (const field of Object.keys(pullObj)) {
                if (Array.isArray(targetDoc[field])) {
                  const arr = targetDoc[field] as unknown[];
                  const val = pullObj[field];
                  targetDoc[field] = arr.filter((item) => item !== val);
                }
              }
            }

            return JSON.parse(JSON.stringify(targetDoc));
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
  // 1. RECHAZO DE SOLICITUDES SIN SESIÓN O CON JWT INVÁLIDO
  // ==========================================================================
  test("1. Rechaza peticiones sin sesión con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /Autenticación requerida/i);
  });

  test("1. Rechaza peticiones con token JWT alterado o corrupto con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupt.signature",
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 401);
  });

  // ==========================================================================
  // 2. RECHAZO DE UN ROL SIN PERMISO PARA GESTIONAR ETIQUETAS
  // ==========================================================================
  test("2. Rechaza con HTTP 403 a usuarios con rol 'reportante'", async () => {
    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /permisos suficientes/i);
  });

  test("2. Rechaza con HTTP 403 a usuarios con rol 'directiva'", async () => {
    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);
  });

  test("2. No confía en encabezado x-user-role para elevar permisos", async () => {
    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-user-role": "admin", // Intento de suplantar rol
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);
  });

  // ==========================================================================
  // 3. RECHAZO DE USUARIOS DESACTIVADOS, INEXISTENTES O DEGRADADOS DE ROL
  // ==========================================================================
  test("3. Rechaza con HTTP 403 a usuarios desactivados en MongoDB", async () => {
    const deactivatedUser: AuthUser = {
      id_usuario: "usr_deactivated",
      nombre: "Técnico Desactivado",
      correo: "desactivado@utm.edu.mx",
      rol: "tecnico",
      departamento: "Soporte Técnico",
    };
    const token = await createSessionToken(deactivatedUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /no corresponde a un usuario activo/i);
  });

  test("3. Rechaza con HTTP 403 a identidades autenticadas que no existen en MongoDB", async () => {
    const ghostUser: AuthUser = {
      id_usuario: "usr_fantasma_99",
      nombre: "Usuario Fantasma",
      correo: "fantasma@utm.edu.mx",
      rol: "admin",
      departamento: "Dirección de TI",
    };
    const token = await createSessionToken(ghostUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);
  });

  test("3. Rechaza con HTTP 403 a usuarios degradados de rol en MongoDB", async () => {
    // JWT afirma ser 'tecnico', pero en BD está registrado como 'reportante'
    const demotedUser: AuthUser = {
      id_usuario: "usr_demoted_to_rep",
      nombre: "Técnico Degradado",
      correo: "degradado@utm.edu.mx",
      rol: "tecnico",
      departamento: "Soporte Técnico",
    };
    const token = await createSessionToken(demotedUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /permisos suficientes/i);
  });

  // ==========================================================================
  // 4. CONFIRMACIÓN DE QUE LAS OPERACIONES NO MODIFICAN EL DOCUMENTO ANTE FALLO DE AUTORIZACIÓN
  // ==========================================================================
  test("4. Confirma que el documento en MongoDB no se modifica cuando falla la autorización", async () => {
    const initialDoc = mockDbStorage.get("65fabc1234567890abcdef01");
    const initialTags = [...(initialDoc?.tags as string[])];

    const token = await createSessionToken(reportanteUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "tag_no_autorizado" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 403);

    const afterDoc = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.deepEqual(afterDoc?.tags, initialTags);
  });

  // ==========================================================================
  // 5. AGREGAR UNA ETIQUETA CORRECTAMENTE
  // ==========================================================================
  test("5. Técnico agrega una etiqueta correctamente por ObjectId", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data, ["redes", "switch", "urgente"]);

    const stored = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.deepEqual(stored?.tags, ["redes", "switch", "urgente"]);
  });

  test("5. Coordinador agrega una etiqueta resolviendo por Folio", async () => {
    const token = await createSessionToken(coordinadorUser);
    const req = new Request("http://localhost:3000/api/incidencias/INC-2026-0001/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "prioridad-alta" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "INC-2026-0001" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.includes("prioridad-alta"));

    const stored = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.ok((stored?.tags as string[]).includes("prioridad-alta"));
  });

  test("5. Administrador agrega una etiqueta correctamente", async () => {
    const token = await createSessionToken(adminUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "revisado_admin" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.includes("revisado_admin"));
  });

  // ==========================================================================
  // 6. AGREGAR UNA ETIQUETA QUE YA EXISTE SIN DUPLICARLA ($addToSet)
  // ==========================================================================
  test("6. Agregar una etiqueta existente no genera duplicados ($addToSet)", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "redes" }), // Ya existe en sampleIncidencia
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data, ["redes", "switch"]);

    const stored = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.deepEqual(stored?.tags, ["redes", "switch"]);
  });

  // ==========================================================================
  // 7. ELIMINAR UNA ETIQUETA EXISTENTE Y MANEJAR ETIQUETA INEXISTENTE ($pull)
  // ==========================================================================
  test("7. Eliminar una etiqueta existente la remueve del documento ($pull)", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "remove", tag: "switch" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data, ["redes"]);

    const stored = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.deepEqual(stored?.tags, ["redes"]);
  });

  test("7. Eliminar una etiqueta no existente no altera la lista de etiquetas", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "remove", tag: "etiqueta_inexistente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data, ["redes", "switch"]);
  });

  // ==========================================================================
  // 8. RECHAZO DE ACCIONES, FORMATOS Y VALORES INVÁLIDOS
  // ==========================================================================
  test("8. Rechaza acción no soportada con HTTP 400", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "delete", tag: "redes" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /tag y action son obligatorios/i);
  });

  test("8. Rechaza etiqueta vacía o con solo espacios con HTTP 400", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "    " }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 400);
  });

  test("8. Rechaza etiqueta que supera 50 caracteres con HTTP 400", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "a".repeat(51) }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 400);
  });

  test("8. Rechaza cuerpo que no es un JSON válido con HTTP 400", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: "{ malformed json",
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /JSON válido/i);
  });

  test("8. Rechaza identificador de incidencia vacío con HTTP 400", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/ /tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "redes" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "   " }),
    });
    assert.equal(res.status, 400);
  });

  // ==========================================================================
  // 9. INCIDENCIA INEXISTENTE
  // ==========================================================================
  test("9. Retorna HTTP 404 si la incidencia no existe en MongoDB Atlas", async () => {
    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc999999999999999999/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "nueva" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc999999999999999999" }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /Incidencia no encontrada/i);
  });

  // ==========================================================================
  // 10. ERROR DE MONGODB CON RESPUESTA SANITIZADA
  // ==========================================================================
  test("10. Sanitiza credenciales y cadenas sensibles cuando MongoDB Atlas falla con HTTP 503", async () => {
    shouldFailMongo = true;
    mongoFailMessage = "MongoNetworkTimeoutError: connection to mongodb://admin:SuperSecretPassword123@cluster0.abcde.mongodb.net:27017 failed";

    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "urgente" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.ok(body.error);
    assert.ok(!body.error.includes("SuperSecretPassword123"));
    assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
  });

  // ==========================================================================
  // 11. CONFIRMACIÓN DE QUE EL ENDPOINT NO DEPENDE DE DATOS SIMULADOS
  // ==========================================================================
  test("11. Confirma que las modificaciones impactan MongoDB y no alteran INCIDENCIAS_INICIALES", async () => {
    const initialMockSnapshot = JSON.stringify(INCIDENCIAS_INICIALES);

    const token = await createSessionToken(tecnicoUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/tags", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "add", tag: "tag_verificacion_mock" }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });
    assert.equal(res.status, 200);

    // Comprobar que en mockDbStorage (MongoDB) sí se agregó
    const stored = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.ok((stored?.tags as string[]).includes("tag_verificacion_mock"));

    // Comprobar que INCIDENCIAS_INICIALES permanece 100% inalterado
    const afterMockSnapshot = JSON.stringify(INCIDENCIAS_INICIALES);
    assert.equal(afterMockSnapshot, initialMockSnapshot);
  });
});
