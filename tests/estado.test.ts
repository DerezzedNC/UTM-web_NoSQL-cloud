import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { MongoClient } from "mongodb";
import { PATCH } from "../app/api/incidencias/[id]/estado/route";
import { createSessionToken, type AuthUser } from "../lib/auth";
import { INCIDENCIAS_INICIALES } from "../lib/incidencias/mock-data";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("PATCH /api/incidencias/[id]/estado - Migración a MongoDB Atlas", () => {
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
  let simulateRaceCondition = false;

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
          comentario: "Apertura de incidencia inicial",
        },
      ],
      evidencias_adjuntas: [],
      ...overrides,
    };
  }

  function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    if (filter.$or && Array.isArray(filter.$or)) {
      const orMatches = filter.$or.some((subFilter) => matchesFilter(doc, subFilter));
      if (!orMatches) return false;
    }
    for (const key of Object.keys(filter)) {
      if (key === "$or") continue;
      const expected = filter[key];
      const actual = doc[key];
      if (typeof expected === "object" && expected !== null) {
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
    simulateRaceCondition = false;

    // Inicializar usuarios canónicos
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
        rol: "reportante", // Degradado en BD a reportante
        activo: true,
      },
    };

    // Inicializar incidencia base
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

            if (simulateRaceCondition) {
              // Simular que otra transacción modificó el estado
              return null;
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
              Object.assign(targetDoc, update.$set);
            }

            // Aplicar $inc
            if (update.$inc && typeof update.$inc === "object") {
              const incObj = update.$inc as Record<string, number>;
              for (const incKey of Object.keys(incObj)) {
                const currentVal = Number(targetDoc[incKey] ?? 0);
                targetDoc[incKey] = currentVal + incObj[incKey];
              }
            }

            // Aplicar $unset
            if (update.$unset && typeof update.$unset === "object") {
              const unsetObj = update.$unset as Record<string, unknown>;
              for (const unsetKey of Object.keys(unsetObj)) {
                delete targetDoc[unsetKey];
              }
            }

            // Aplicar $push
            if (update.$push && typeof update.$push === "object") {
              const pushObj = update.$push as Record<string, unknown>;
              for (const pushKey of Object.keys(pushObj)) {
                const val = pushObj[pushKey] as Record<string, unknown>;
                if (!Array.isArray(targetDoc[pushKey])) {
                  targetDoc[pushKey] = [];
                }
                const arr = targetDoc[pushKey] as unknown[];
                if (val && typeof val === "object" && "$each" in val) {
                  const eachItems = (val as { $each: unknown[]; $position?: number }).$each;
                  const position = (val as { $position?: number }).$position ?? arr.length;
                  arr.splice(position, 0, ...eachItems);
                } else {
                  arr.push(val);
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
  // 1. SESIÓN AUSENTE O INVÁLIDA (HTTP 401)
  // ==========================================================================
  test("1. Rechaza peticiones sin sesión con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Inicio de revisión técnica",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Autenticación requerida/i);
  });

  test("1. Rechaza peticiones con token JWT alterado o corrupto con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token_completamente_falso_y_manipulado",
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Inicio",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 401);
  });

  // ==========================================================================
  // 2. ROLES SIN PERMISO (HTTP 403)
  // ==========================================================================
  test("2. Rechaza con HTTP 403 a usuarios con roles sin permiso 'incidencia:update' (reportante, directiva)", async () => {
    const repToken = await createSessionToken(reportanteUser);
    const dirToken = await createSessionToken(directivaUser);

    for (const token of [repToken, dirToken]) {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estado_nuevo: "en_proceso",
          horas_sumadas: 1,
          comentario: "Intento de actualización no autorizado",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });

      assert.equal(res.status, 403);
      const body = (await res.json()) as { error: string };
      assert.match(body.error, /no cuenta con permisos|no tiene permisos/i);
    }
  });

  test("2. Rechaza con HTTP 403 a usuarios desactivados en MongoDB y no modifica la incidencia", async () => {
    // Usuario cuyo JWT dice "tecnico", pero está inactivo en MongoDB
    const deactivatedToken = await createSessionToken({
      id_usuario: "usr_deactivated",
      nombre: "Técnico Desactivado",
      correo: "desactivado@utm.edu.mx",
      rol: "tecnico",
      departamento: "Soporte",
    });

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${deactivatedToken}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 5,
        comentario: "Intento de actualización por usuario desactivado",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /usuario activo registrado/i);

    // Verificar que el documento NO fue modificado
    const doc = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.equal(doc?.estado, "abierta");
    assert.equal(doc?.horas_invertidas, 0);
  });

  test("2. Rechaza con HTTP 403 a usuarios degradados de rol en MongoDB y no modifica la incidencia", async () => {
    // Usuario cuyo JWT desfasado dice "tecnico", pero en MongoDB ya fue degradado a "reportante"
    const demotedToken = await createSessionToken({
      id_usuario: "usr_demoted_to_rep",
      nombre: "Técnico Degradado",
      correo: "degradado@utm.edu.mx",
      rol: "tecnico", // JWT desfasado
      departamento: "Soporte",
    });

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${demotedToken}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 3,
        comentario: "Intento con rol degradado",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /no cuenta con permisos suficientes/i);

    // Verificar que el documento NO fue modificado
    const doc = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.equal(doc?.estado, "abierta");
    assert.equal(doc?.horas_invertidas, 0);
  });

  test("2. Rechaza con HTTP 403 a identidades autenticadas que no existen en la colección de usuarios", async () => {
    const ghostToken = await createSessionToken({
      id_usuario: "usr_inexistente_bd",
      nombre: "Usuario Fantasma",
      correo: "ghost@utm.edu.mx",
      rol: "tecnico",
      departamento: "Soporte",
    });

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ghostToken}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Intento por usuario no registrado",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /usuario activo registrado/i);

    const doc = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.equal(doc?.estado, "abierta");
    assert.equal(doc?.horas_invertidas, 0);
  });

  // ==========================================================================
  // 3. ESTADO SOLICITADO INVÁLIDO Y VALIDACIÓN DE PAYLOAD (HTTP 400)
  // ==========================================================================
  test("3. Rechaza cuerpo no JSON o datos inválidos con HTTP 400", async () => {
    const token = await createSessionToken(tecnicoUser);

    // Body no es JSON válido
    {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: "{ esto no es json",
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: string };
      assert.match(body.error, /JSON válido/i);
    }

    // Estado no perteneciente al catálogo
    {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estado_nuevo: "estado_inventado",
          horas_sumadas: 1,
          comentario: "Revisado",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 400);
    }

    // Horas sumadas negativas
    {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estado_nuevo: "en_proceso",
          horas_sumadas: -3,
          comentario: "Horas inválidas",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 400);
    }

    // Comentario vacío o ausente
    {
      const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estado_nuevo: "en_proceso",
          horas_sumadas: 1,
          comentario: "   ",
        }),
      });

      const res = await PATCH(req, {
        params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
      });
      assert.equal(res.status, 400);
    }
  });

  // ==========================================================================
  // 4. TRANSICIONES NO PERMITIDAS SEGÚN POLÍTICA DE ROLES (HTTP 403)
  // ==========================================================================
  test("4. El rol Técnico solo puede avanzar hasta 'resuelta' y no puede cerrar directamente (HTTP 403)", async () => {
    const token = await createSessionToken(tecnicoUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "cerrada",
        horas_sumadas: 1,
        comentario: "Intento de cierre directo por técnico",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /El rol Técnico solo puede avanzar hasta resuelta/i);
  });

  test("4. El rol Técnico no puede reabrir ni modificar una incidencia ya cerrada (HTTP 403)", async () => {
    // Configurar incidencia ya cerrada
    const cerradaDoc = sampleIncidencia({
      _id: "65fabc_cerrada_doc",
      estado: "cerrada",
      fecha_resolucion: new Date(),
    });
    mockDbStorage.set(String(cerradaDoc._id), cerradaDoc);

    const token = await createSessionToken(tecnicoUser);

    const req = new Request(`http://localhost:3000/api/incidencias/${cerradaDoc._id}/estado`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Técnico intentando reabrir ticket cerrado",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: String(cerradaDoc._id) }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Una incidencia cerrada solo puede ser modificada/i);
  });

  // ==========================================================================
  // 5. ACTUALIZACIÓN EXITOSA Y PERSISTENCIA ATÓMICA (HTTP 200)
  // ==========================================================================
  test("5. Técnico avanza incidencia de 'abierta' a 'en_proceso' con horas y bitácora atómica", async () => {
    const token = await createSessionToken(tecnicoUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en proceso", // Normaliza de "en proceso" a "en_proceso"
        horas_sumadas: 2.5,
        comentario: "Se sustituyó el patch cord y se reinició el puerto uplink.",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    assert.equal(body.data.estado, "en_proceso");
    assert.equal(body.data.horas_invertidas, 2.5);

    // Historial prepended en posición 0
    const historial = body.data.historial_seguimiento as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(historial));
    assert.equal(historial.length, 2);
    assert.equal(historial[0].estado_nuevo, "en_proceso");
    assert.equal(historial[0].horas_sumadas, 2.5);
    assert.equal(historial[0].autor, "Carlos Mendoza");
    assert.equal(historial[0].comentario, "Se sustituyó el patch cord y se reinició el puerto uplink.");

    // Comprobar persistencia real en el mock de almacenamiento
    const stored = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.ok(stored);
    assert.equal(stored.estado, "en_proceso");
    assert.equal(stored.horas_invertidas, 2.5);
  });

  test("5. Coordinador avanza incidencia a 'resuelta' y establece fecha_resolucion", async () => {
    const token = await createSessionToken(coordinadorUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "resuelta",
        horas_sumadas: 1.0,
        comentario: "Pruebas de conectividad exitosas en laboratorio A.",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    assert.equal(body.data.estado, "resuelta");
    assert.ok(body.data.fecha_resolucion, "Debe registrar fecha_resolucion al resolver");
  });

  test("5. Administrador cierra definitivamente la incidencia y soporta búsqueda por folio", async () => {
    const token = await createSessionToken(adminUser);

    const req = new Request("http://localhost:3000/api/incidencias/INC-2026-0001/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "cerrada",
        horas_sumadas: 0.5,
        comentario: "Cierre definitivo validado por coordinación y usuario.",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "INC-2026-0001" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    assert.equal(body.data.folio, "INC-2026-0001");
    assert.equal(body.data.estado, "cerrada");
    assert.ok(body.data.fecha_resolucion);
  });

  test("5. Reabrir incidencia desasocia fecha_resolucion con $unset", async () => {
    const resueltaDoc = sampleIncidencia({
      _id: "65fabc_resuelta_doc",
      estado: "resuelta",
      fecha_resolucion: new Date("2026-10-26T12:00:00Z"),
    });
    mockDbStorage.set(String(resueltaDoc._id), resueltaDoc);

    const token = await createSessionToken(coordinadorUser);

    const req = new Request(`http://localhost:3000/api/incidencias/${resueltaDoc._id}/estado`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_espera",
        horas_sumadas: 0,
        comentario: "Se reabre temporalmente en espera de refacciones de repuesto.",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: String(resueltaDoc._id) }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    assert.equal(body.data.estado, "en_espera");
    assert.equal(body.data.fecha_resolucion, undefined, "fecha_resolucion debe ser eliminada al reabrir");
  });

  // ==========================================================================
  // 6. INCIDENCIA INEXISTENTE (HTTP 404)
  // ==========================================================================
  test("6. Retorna HTTP 404 cuando la incidencia no existe", async () => {
    const token = await createSessionToken(tecnicoUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc999999999999999999/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Ticket inexistente",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc999999999999999999" }),
    });

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Incidencia no encontrada/i);
  });

  // ==========================================================================
  // 7. CONFLICTOS Y ACTUALIZACIONES CONCURRENTES (HTTP 409)
  // ==========================================================================
  test("7. Detecta conflicto de concurrencia optimista si el cliente envía un estado_actual desfasado", async () => {
    const token = await createSessionToken(tecnicoUser);

    // La incidencia en BD está en "abierta", pero el cliente envía estado_actual="en_proceso"
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "resuelta",
        estado_actual: "en_proceso", // Desfasado con la realidad ("abierta")
        horas_sumadas: 1,
        comentario: "Resolución de ticket",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Conflicto de concurrencia/i);
  });

  test("7. Detecta colisión de concurrencia atómica cuando otra operación modifica el estado simultáneamente", async () => {
    simulateRaceCondition = true;
    const token = await createSessionToken(tecnicoUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Intento concurrente",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Conflicto de concurrencia/i);
  });

  // ==========================================================================
  // 8. ERROR DE MONGODB CON RESPUESTA SANITIZADA (HTTP 503)
  // ==========================================================================
  test("8. Sanitiza credenciales y cadenas sensibles cuando MongoDB Atlas falla (HTTP 503)", async () => {
    shouldFailMongo = true;
    mongoFailMessage =
      "MongoServerSelectionError: connection timeout to mongodb+srv://admin_atlas:MasterKeyPassword999@cluster0.utm.mongodb.net/utm_desk_db";

    const token = await createSessionToken(tecnicoUser);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/estado", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 1,
        comentario: "Intento con BD caída",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "65fabc1234567890abcdef01" }),
    });

    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error);
    assert.equal(body.error.includes("MasterKeyPassword999"), false);
    assert.ok(body.error.includes("[REDACTED_CREDENTIALS]"));
  });

  // ==========================================================================
  // 9. CONFIRMACIÓN DE QUE EL ENDPOINT YA NO DEPENDE DEL STORE SIMULADO
  // ==========================================================================
  test("9. Confirma que la actualización persiste en MongoDB y no altera INCIDENCIAS_INICIALES", async () => {
    const exclusiveId = "mongo_exclusive_estado_test";
    const initialCopyBefore = JSON.parse(JSON.stringify(INCIDENCIAS_INICIALES));

    const exclusiveDoc = sampleIncidencia({
      _id: exclusiveId,
      folio: "INC-2026-7777",
      estado: "abierta",
      horas_invertidas: 0,
    });
    mockDbStorage.set(exclusiveId, exclusiveDoc);

    const token = await createSessionToken(coordinadorUser);

    const req = new Request(`http://localhost:3000/api/incidencias/${exclusiveId}/estado`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        estado_nuevo: "en_proceso",
        horas_sumadas: 3.0,
        comentario: "Actualización persistida directamente en MongoDB Atlas",
      }),
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: exclusiveId }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: Record<string, unknown> };

    assert.equal(body.data._id, exclusiveId);
    assert.equal(body.data.estado, "en_proceso");
    assert.equal(body.data.horas_invertidas, 3.0);

    // Verificar que en mockDbStorage se persistió
    const inDb = mockDbStorage.get(exclusiveId);
    assert.equal(inDb?.estado, "en_proceso");
    assert.equal(inDb?.horas_invertidas, 3.0);

    // Verificar que INCIDENCIAS_INICIALES no fue alterado
    assert.deepEqual(INCIDENCIAS_INICIALES, initialCopyBefore);
  });
});
