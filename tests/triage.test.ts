import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ObjectId, type MongoClient } from "mongodb";
import { GET, PATCH } from "../app/api/incidencias/[id]/route";
import { createSessionToken, type AuthUser } from "../lib/auth";
import { INCIDENCIAS_INICIALES } from "../lib/incidencias/mock-data";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("GET & PATCH /api/incidencias/[id] - Detalle y Clasificación (Triage) en MongoDB Atlas", () => {
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

  const tecnicoUser: AuthUser = {
    id_usuario: "usr_tec_01",
    nombre: "Carlos Mendoza",
    correo: "cmendoza@utm.edu.mx",
    rol: "tecnico",
    area_asignada: "computo_redes",
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

  const directivaUser: AuthUser = {
    id_usuario: "usr_dir_01",
    nombre: "Dra. Arizmendi",
    correo: "directiva@utm.edu.mx",
    rol: "directiva",
    departamento: "Dirección",
  };

  const mockDbStorage: Map<string, Record<string, unknown>> = new Map();
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
      historial_seguimiento: [
        {
          fecha: new Date("2026-10-25T10:00:00.000Z"),
          autor: "Ing. Roberto Salgado",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Apertura inicial de incidencia",
        },
      ],
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

  beforeEach(() => {
    mockDbStorage.clear();
    shouldFailMongo = false;
    mongoFailMessage = "";

    const mockUsers: Record<string, Record<string, unknown>> = {
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
      [tecnicoUser.id_usuario]: {
        id_usuario: tecnicoUser.id_usuario,
        nombre: tecnicoUser.nombre,
        correo: tecnicoUser.correo,
        rol: tecnicoUser.rol,
        activo: true,
        area_asignada: "computo_redes",
        departamento: "Soporte Técnico",
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
        nombre: "Coordinador Inactivo",
        correo: "inactivo@utm.edu.mx",
        rol: "coordinador",
        activo: false,
      },
      usr_demoted_to_rep: {
        id_usuario: "usr_demoted_to_rep",
        nombre: "Coordinador Degradado",
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
            findOne: async (filter: Record<string, unknown>) => {
              if (shouldFailMongo) {
                throw new Error(mongoFailMessage || "Error simulado en usuarios.findOne");
              }
              const id = filter.id_usuario as string;
              if (id && mockUsers[id]) {
                const u = mockUsers[id];
                if (filter.activo !== undefined && u.activo !== filter.activo) {
                  return null;
                }
                if (filter.rol !== undefined && u.rol !== filter.rol) {
                  return null;
                }
                return JSON.parse(JSON.stringify(u));
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

            // Aplicar $set
            if (update.$set && typeof update.$set === "object") {
              const setObj = update.$set as Record<string, unknown>;
              for (const [k, v] of Object.entries(setObj)) {
                if (k.includes(".")) {
                  const parts = k.split(".");
                  let curr = targetDoc as Record<string, unknown>;
                  for (let i = 0; i < parts.length - 1; i++) {
                    if (!curr[parts[i]] || typeof curr[parts[i]] !== "object") {
                      curr[parts[i]] = {};
                    }
                    curr = curr[parts[i]] as Record<string, unknown>;
                  }
                  curr[parts[parts.length - 1]] = v;
                } else {
                  targetDoc[k] = v;
                }
              }
            }

            // Aplicar $unset
            if (update.$unset && typeof update.$unset === "object") {
              const unsetObj = update.$unset as Record<string, unknown>;
              for (const k of Object.keys(unsetObj)) {
                delete targetDoc[k];
              }
            }

            // Aplicar $push
            if (update.$push && typeof update.$push === "object") {
              const pushObj = update.$push as Record<string, unknown>;
              for (const [k, v] of Object.entries(pushObj)) {
                if (!Array.isArray(targetDoc[k])) {
                  targetDoc[k] = [];
                }
                const arr = targetDoc[k] as unknown[];
                if (v && typeof v === "object" && "$each" in v && Array.isArray((v as Record<string, unknown>).$each)) {
                  const eachArr = (v as Record<string, unknown>).$each as unknown[];
                  const eachObj = v as Record<string, unknown>;
                  const pos = typeof eachObj.$position === "number" ? (eachObj.$position as number) : arr.length;
                  arr.splice(pos, 0, ...eachArr);
                } else {
                  arr.push(v);
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
  // 1. GET /api/incidencias/[id] - Pruebas de Detalle y Visibilidad por Rol
  // ==========================================================================
  test("1. Rechaza solicitud sin sesión con HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01");
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 401);
    });

    test("Rechaza token JWT manipulado con HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: "Bearer invalid.jwt.token" },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 401);
    });

    test("Permite a Coordinador y Admin consultar cualquier incidencia por ObjectId o Folio", async () => {
      const coordToken = await createSessionToken(coordinadorUser);
      const reqCoord = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: `Bearer ${coordToken}` },
      });
      const resCoord = await GET(reqCoord, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(resCoord.status, 200);
      const bodyCoord = (await resCoord.json()) as { data: { folio: string; titulo: string } };
      assert.equal(bodyCoord.data.folio, "INC-2026-0001");

      const adminToken = await createSessionToken(adminUser);
      const reqAdmin = new Request("http://localhost:3000/api/incidencias/INC-2026-0001", {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const resAdmin = await GET(reqAdmin, {
        params: Promise.resolve({ id: "INC-2026-0001" }),
      });
      assert.equal(resAdmin.status, 200);
      const bodyAdmin = (await resAdmin.json()) as { data: { folio: string } };
      assert.equal(bodyAdmin.data.folio, "INC-2026-0001");
    });

    test("Reportante puede consultar sus incidencias propias con HTTP 200", async () => {
      const token = await createSessionToken(reportanteUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 200);
    });

    test("Reportante es rechazado con HTTP 403 al intentar consultar una incidencia ajena", async () => {
      const otherUser: AuthUser = {
        id_usuario: "usr_other_reporter",
        nombre: "Otro Usuario",
        correo: "otro@utm.edu.mx",
        rol: "reportante",
        rol_institucional: "Estudiante",
        departamento: "Ingeniería de Software",
      };
      const token = await createSessionToken(otherUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.error, /No tienes permiso para ver este expediente/i);
    });

    test("Técnico asignado puede consultar su incidencia asignada con HTTP 200", async () => {
      // Asignar al técnico en base de datos
      const doc = sampleIncidencia({
        tecnico_asignado: {
          id_usuario: "usr_tec_01",
          nombre: "Carlos Mendoza",
          correo: "cmendoza@utm.edu.mx",
        },
      });
      mockDbStorage.set(String(doc._id), doc);

      const token = await createSessionToken(tecnicoUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 200);
    });

    test("Técnico no asignado es rechazado con HTTP 403 al consultar incidencia sin asignar o de otro técnico", async () => {
      // El sampleIncidencia por defecto no tiene tecnico_asignado
      const token = await createSessionToken(tecnicoUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.error, /No tienes permiso para ver este expediente/i);
    });

    test("Retorna HTTP 404 cuando la incidencia no existe", async () => {
      const token = await createSessionToken(adminUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc999999999999999999", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc999999999999999999" }),
      });
      assert.equal(res.status, 404);
    });

    test("Sanitiza credenciales y cadenas sensibles cuando falla MongoDB con HTTP 503", async () => {
      shouldFailMongo = true;
      mongoFailMessage = "MongoNetworkTimeoutError: connection to mongodb://admin:SuperSecret123@atlas-cluster.utm.mongodb.net failed";

      const token = await createSessionToken(adminUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await GET(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.ok(!body.error.includes("SuperSecret123"));
      assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
    });

  // ==========================================================================
  // 2. PATCH /api/incidencias/[id] - Pruebas de Clasificación y Asignación (Triage)
  // ==========================================================================
  test("2. Rechaza solicitud sin sesión con HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prioridad: "critica" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 401);
    });

    test("Rechaza con HTTP 403 a roles sin permiso 'incidencia:triage' (reportante, tecnico, directiva)", async () => {
      for (const unauthorized of [reportanteUser, tecnicoUser, directivaUser]) {
        const token = await createSessionToken(unauthorized);
        const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prioridad: "critica" }),
        });
        const res = await PATCH(req, {
          params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
        });
        assert.equal(res.status, 403, `Rol ${unauthorized.rol} no debe tener permiso de triage`);
        const body = await res.json();
        assert.match(body.error, /Solo el Coordinador o Administrador/i);
      }
    });

    test("No confía en x-user-role para elevar permisos a admin o coordinador", async () => {
      const token = await createSessionToken(tecnicoUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-user-role": "coordinador", // Intento de suplantación
        },
        body: JSON.stringify({ prioridad: "critica" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 403);
    });

    test("Rechaza con HTTP 403 a usuarios inactivos o degradados en MongoDB", async () => {
      // Inactivo
      const inactiveUser: AuthUser = {
        id_usuario: "usr_deactivated",
        nombre: "Coordinador Inactivo",
        correo: "inactivo@utm.edu.mx",
        rol: "coordinador",
        departamento: "Coordinación de Tecnologías",
      };
      const tokenInactive = await createSessionToken(inactiveUser);
      const reqInactive = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tokenInactive}`,
        },
        body: JSON.stringify({ prioridad: "critica" }),
      });
      const resInactive = await PATCH(reqInactive, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(resInactive.status, 403);

      // Degradado (JWT dice coordinador, en MongoDB es reportante)
      const demotedUser: AuthUser = {
        id_usuario: "usr_demoted_to_rep",
        nombre: "Coordinador Degradado",
        correo: "degradado@utm.edu.mx",
        rol: "coordinador",
        departamento: "Coordinación de Tecnologías",
      };
      const tokenDemoted = await createSessionToken(demotedUser);
      const reqDemoted = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tokenDemoted}`,
        },
        body: JSON.stringify({ prioridad: "critica" }),
      });
      const resDemoted = await PATCH(reqDemoted, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(resDemoted.status, 403);
    });

    test("Rechaza prioridad inválida con HTTP 400", async () => {
      const token = await createSessionToken(coordinadorUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prioridad: "super_ultra_alta" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /Datos de clasificación inválidos/i);
    });

    test("Rechaza id_tecnico inexistente o no disponible con HTTP 400", async () => {
      const token = await createSessionToken(coordinadorUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id_tecnico: "usr_inexistente_999" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /no es válido o no está activo/i);
    });

    test("Coordinador clasifica prioridad, actualiza riesgo de seguridad y asigna técnico exitosamente", async () => {
      const doc = sampleIncidencia({
        categoria: "infraestructura",
        detalle_especifico: {
          tipo_dano: "Fisura en muro",
          riesgo_seguridad: "Bajo",
          requiere_insumos: false,
          insumos_solicitados: [],
          contratista_externo: false,
        },
      });
      mockDbStorage.set(String(doc._id), doc);

      const token = await createSessionToken(coordinadorUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prioridad: "critica",
          id_tecnico: "usr_tec_01",
          riesgo_seguridad: "Alto",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 200);

      const body = (await res.json()) as {
        data: {
          prioridad: string;
          tecnico_asignado?: { id_usuario: string; nombre: string; correo: string };
          detalle_especifico?: { riesgo_seguridad?: string };
          historial_seguimiento: Array<{ comentario: string }>;
        };
      };

      assert.equal(body.data.prioridad, "critica");
      assert.ok(body.data.tecnico_asignado);
      assert.equal(body.data.tecnico_asignado?.id_usuario, "usr_tec_01");
      assert.equal(body.data.tecnico_asignado?.nombre, "Carlos Mendoza");
      assert.equal(body.data.detalle_especifico?.riesgo_seguridad, "Alto");

      // Comprobar que en base de datos quedó persistido
      const stored = mockDbStorage.get("65fabc1234567890abcdef01");
      assert.equal(stored?.prioridad, "critica");
      const storedTec = stored?.tecnico_asignado as Record<string, unknown>;
      assert.equal(storedTec?.id_usuario, "usr_tec_01");

      // Comprobar que se agregó la entrada a historial_seguimiento (en posición 0 por $position: 0)
      const historial = stored?.historial_seguimiento as Array<{ comentario: string; autor: string }>;
      assert.ok(historial.length >= 2);
      const newestEntry = historial[0];
      assert.equal(newestEntry.autor, "Ing. Beatriz Paredes");
      assert.ok(newestEntry.comentario.includes("Prioridad definida como Crítica"));
      assert.ok(newestEntry.comentario.includes("Asignada a Carlos Mendoza"));
    });

    test("Desasigna técnico enviando id_tecnico: null", async () => {
      // Configurar incidencia con técnico asignado previamente
      const doc = sampleIncidencia({
        tecnico_asignado: {
          id_usuario: "usr_tec_01",
          nombre: "Carlos Mendoza",
          correo: "cmendoza@utm.edu.mx",
        },
      });
      mockDbStorage.set(String(doc._id), doc);

      const token = await createSessionToken(adminUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_tecnico: null,
          prioridad: "baja",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 200);

      const body = (await res.json()) as { data: { prioridad: string; tecnico_asignado?: unknown } };
      assert.equal(body.data.prioridad, "baja");
      assert.equal(body.data.tecnico_asignado, undefined);

      const stored = mockDbStorage.get("65fabc1234567890abcdef01");
      assert.equal(stored?.tecnico_asignado, undefined);
    });

    test("Retorna HTTP 404 al intentar clasificar una incidencia inexistente", async () => {
      const token = await createSessionToken(coordinadorUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc999999999999999999", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prioridad: "alta" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc999999999999999999" }),
      });
      assert.equal(res.status, 404);
    });

    test("Sanitiza credenciales y cadenas sensibles cuando falla MongoDB con HTTP 503", async () => {
      shouldFailMongo = true;
      mongoFailMessage = "MongoWriteError: connection failed mongodb+srv://adm:TopSecretPassword999@atlas-cluster.utm.mongodb.net";

      const token = await createSessionToken(coordinadorUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prioridad: "alta" }),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.ok(!body.error.includes("TopSecretPassword999"));
      assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
    });

    test("Confirma que las actualizaciones impactan MongoDB y no mutan INCIDENCIAS_INICIALES", async () => {
      const initialMockSnapshot = JSON.stringify(INCIDENCIAS_INICIALES);

      const token = await createSessionToken(coordinadorUser);
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prioridad: "critica" }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 200);

      // Comprobar que en mockDbStorage (MongoDB) se actualizó
      const stored = mockDbStorage.get("65fabc1234567890abcdef01");
      assert.equal(stored?.prioridad, "critica");

      // Comprobar que INCIDENCIAS_INICIALES permanece intacto
      assert.equal(JSON.stringify(INCIDENCIAS_INICIALES), initialMockSnapshot);
    });
});
