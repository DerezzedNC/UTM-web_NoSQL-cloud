import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ObjectId, type MongoClient } from "mongodb";
import { GET, POST } from "../app/api/incidencias/[id]/evidencias/route";
import { createSessionToken, type AuthUser } from "../lib/auth";
import { setSupabaseClientForTesting } from "../lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long-123456";
}

describe("POST /api/incidencias/[id]/evidencias - Carga en Supabase Storage y MongoDB Atlas", () => {
  const reportanteOwner: AuthUser = {
    id_usuario: "usr_rep_10",
    nombre: "Ing. Roberto Salgado",
    correo: "rsalgado@utm.edu.mx",
    rol: "reportante",
    rol_institucional: "Docente",
    departamento: "Ingeniería de Software",
  };

  const reportanteOther: AuthUser = {
    id_usuario: "usr_rep_99",
    nombre: "Reportante Ajeno",
    correo: "ajeno@utm.edu.mx",
    rol: "reportante",
    rol_institucional: "Estudiante",
    departamento: "Ingeniería en Computación",
  };

  const tecnicoAssigned: AuthUser = {
    id_usuario: "usr_tec_01",
    nombre: "Carlos Mendoza",
    correo: "cmendoza@utm.edu.mx",
    rol: "tecnico",
    area_asignada: "computo_redes",
    departamento: "Soporte Técnico",
  };

  const tecnicoOther: AuthUser = {
    id_usuario: "usr_tec_99",
    nombre: "Otro Técnico",
    correo: "otro_tec@utm.edu.mx",
    rol: "tecnico",
    area_asignada: "infraestructura",
    departamento: "Mantenimiento",
  };

  const coordinadorUser: AuthUser = {
    id_usuario: "usr_coord_01",
    nombre: "Ing. Beatriz Paredes",
    correo: "coordinacion@utm.edu.mx",
    rol: "coordinador",
    departamento: "Coordinación de Tecnologías",
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
  let shouldFailSupabase = false;

  const originalMongoPromise = global._mongoClientPromise;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  function sampleIncidencia(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      _id: new ObjectId("65fabc1234567890abcdef01"),
      folio: "INC-2026-0001",
      titulo: "Falla de switch sala A",
      categoria: "computo_redes",
      prioridad: "alta",
      estado: "abierta",
      reportante: {
        id_usuario: "usr_rep_10",
        nombre: "Ing. Roberto Salgado",
        correo: "rsalgado@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "usr_tec_01",
        nombre: "Carlos Mendoza",
        correo: "cmendoza@utm.edu.mx",
      },
      evidencias_adjuntas: [],
      historial_seguimiento: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    mockDbStorage = new Map();
    shouldFailMongo = false;
    mongoFailMessage = "";
    shouldFailSupabase = false;

    // Configurar variables ficticias para que hasSupabaseConfigured() sea true
    process.env.SUPABASE_URL = "https://xyzproject.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-12345";

    const doc = sampleIncidencia();
    mockDbStorage.set(String(doc._id), doc);

    // Configurar doble de prueba de Supabase
    const mockSupabaseStorage = {
      listBuckets: async () => ({ data: [{ name: "evidencias-utm" }] }),
      createBucket: async () => ({ data: null, error: null }),
      upload: async () => {
        if (shouldFailSupabase) {
          return { error: { message: "Storage upload failed: network error" } };
        }
        return { data: { path: "some/path" }, error: null };
      },
      createSignedUrl: async (path: string) => {
        return {
          data: { signedUrl: `https://xyzproject.supabase.co/storage/v1/object/sign/evidencias-utm/${path}?token=signed123` },
          error: null,
        };
      },
    };

    const mockSupabaseClient = {
      storage: {
        listBuckets: mockSupabaseStorage.listBuckets,
        createBucket: mockSupabaseStorage.createBucket,
        from: () => mockSupabaseStorage,
      },
    } as unknown as SupabaseClient;

    setSupabaseClientForTesting(mockSupabaseClient);

    // Configurar doble de prueba de MongoDB
    const mockCollection = {
      findOne: async (query: Record<string, unknown>) => {
        if (shouldFailMongo) throw new Error(mongoFailMessage || "Error simulado en MongoDB");
        if (query.id_usuario) {
          const id = String(query.id_usuario);
          if (id === "usr_rep_10") return { ...reportanteOwner, activo: true };
          if (id === "usr_rep_99") return { ...reportanteOther, activo: true };
          if (id === "usr_tec_01") return { ...tecnicoAssigned, activo: true };
          if (id === "usr_tec_99") return { ...tecnicoOther, activo: true };
          if (id === "usr_coord_01") return { ...coordinadorUser, activo: true };
          if (id === "usr_dir_01") return { ...directivaUser, activo: true };
          return null;
        }

        // Búsqueda de incidencia
        for (const item of mockDbStorage.values()) {
          if (query.$or) {
            for (const cond of query.$or as Array<Record<string, unknown>>) {
              if (cond._id && String(cond._id) === String(item._id)) return item;
              if (cond.folio && cond.folio === item.folio) return item;
            }
          }
          if (query.folio && query.folio === item.folio) return item;
        }
        return null;
      },
      updateOne: async (filter: Record<string, unknown>, updateOp: Record<string, unknown>) => {
        if (shouldFailMongo) throw new Error(mongoFailMessage || "Error simulado en updateOne");

        let target: Record<string, unknown> | null = null;
        for (const item of mockDbStorage.values()) {
          if (filter.$or) {
            for (const cond of filter.$or as Array<Record<string, unknown>>) {
              if (cond._id && String(cond._id) === String(item._id)) target = item;
              if (cond.folio && cond.folio === item.folio) target = item;
            }
          }
          if (filter.folio && filter.folio === item.folio) target = item;
        }

        if (!target) return { matchedCount: 0, modifiedCount: 0 };

        if (updateOp.$push) {
          const pushes = updateOp.$push as Record<string, unknown>;
          for (const [key, val] of Object.entries(pushes)) {
            if (!Array.isArray(target[key])) target[key] = [];
            (target[key] as unknown[]).push(val);
          }
        }

        return { matchedCount: 1, modifiedCount: 1 };
      },
    };

    const mockDb = {
      collection: () => mockCollection,
    };

    const mockClient = {
      db: () => mockDb,
    } as unknown as MongoClient;

    global._mongoClientPromise = Promise.resolve(mockClient);
  });

  afterEach(() => {
    global._mongoClientPromise = originalMongoPromise;
    setSupabaseClientForTesting(null);
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
  });

  // ==========================================================================
  // 1. AUTENTICACIÓN Y ROLES
  // ==========================================================================
  test("1. Rechaza petición sin sesión con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 401);
  });

  test("1. Rechaza con HTTP 403 a roles sin permiso 'evidencia:upload' (directiva)", async () => {
    const token = await createSessionToken(directivaUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /permisos para adjuntar evidencias/i);
  });

  // ==========================================================================
  // 2. SCOPING POR PROPIEDAD Y ASIGNACIÓN DE EXPEDIENTE
  // ==========================================================================
  test("2. Rechaza con HTTP 403 si un reportante intenta adjuntar evidencia a un ticket ajeno", async () => {
    const token = await createSessionToken(reportanteOther);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /expediente ajeno/i);
  });

  test("2. Rechaza con HTTP 403 si un técnico no asignado intenta adjuntar evidencia a la incidencia", async () => {
    const token = await createSessionToken(tecnicoOther);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /técnico asignado/i);
  });

  test("2. Retorna HTTP 404 si la incidencia no existe", async () => {
    const token = await createSessionToken(reportanteOwner);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc999999999999999999/evidencias", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "65fabc999999999999999999" }) });
    assert.equal(res.status, 404);
  });

  // ==========================================================================
  // 3. VALIDACIÓN DE ARCHIVOS
  // ==========================================================================
  test("3. Rechaza formato no permitido (ej. text/plain o zip) con HTTP 400", async () => {
    const token = await createSessionToken(reportanteOwner);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nombre_archivo: "script.sh",
        tipo_mime: "text/x-shellscript",
        contenido_base64: Buffer.from("echo hello").toString("base64"),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /Tipo de archivo no permitido/i);
  });

  test("3. Rechaza archivo que excede 5 MB con HTTP 400", async () => {
    const token = await createSessionToken(reportanteOwner);
    // Buffer de 5.5 MB
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nombre_archivo: "captura_grande.png",
        tipo_mime: "image/png",
        contenido_base64: largeBuffer.toString("base64"),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /excede el tamaño máximo/i);
  });

  // ==========================================================================
  // 4. FLUJO EXITOSO Y MANEJO DE FALLOS DE STORAGE
  // ==========================================================================
  test("4. Reportante dueño adjunta evidencia exitosamente vía JSON base64 y actualiza MongoDB y Supabase", async () => {
    const token = await createSessionToken(reportanteOwner);
    const content = Buffer.from("fake-png-binary-content");
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nombre_archivo: "evidencia_foto.png",
        tipo_mime: "image/png",
        contenido_base64: content.toString("base64"),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      data: {
        nombre_archivo: string;
        tipo_mime: string;
        peso_kb: number;
        storage_key: string;
        url_firmada: string;
      };
    };

    assert.equal(body.data.nombre_archivo, "evidencia_foto.png");
    assert.equal(body.data.tipo_mime, "image/png");
    assert.ok(body.data.storage_key.includes("evidencias-utm"));
    assert.ok(body.data.url_firmada.includes("token=signed123"));

    // Verificar en MongoDB
    const doc = mockDbStorage.get("65fabc1234567890abcdef01");
    assert.ok(doc);
    const evidencias = doc.evidencias_adjuntas as Array<{ nombre_archivo: string; storage_key: string }>;
    assert.equal(evidencias.length, 1);
    assert.equal(evidencias[0].nombre_archivo, "evidencia_foto.png");

    const bitacora = doc.historial_seguimiento as Array<{ comentario: string }>;
    assert.ok(bitacora.some((b) => b.comentario.includes("Se adjuntó evidencia")));
  });

  test("4. Técnico asignado adjunta evidencia técnica vía FormData ('file') exitosamente", async () => {
    const token = await createSessionToken(tecnicoAssigned);
    const formData = new FormData();
    const fakeFile = new File([Buffer.from("%PDF-1.4 test document")], "diagnostico.pdf", {
      type: "application/pdf",
    });
    formData.append("file", fakeFile);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      data: { nombre_archivo: string; tipo_mime: string };
      evidencias_adjuntas: Array<{ nombre_archivo: string; tipo_mime: string }>;
    };
    assert.equal(body.data.nombre_archivo, "diagnostico.pdf");
    assert.equal(body.data.tipo_mime, "application/pdf");
    assert.ok(Array.isArray(body.evidencias_adjuntas));
    assert.equal(body.evidencias_adjuntas.length, 1);
    assert.equal(body.evidencias_adjuntas[0].nombre_archivo, "diagnostico.pdf");
  });

  test("4. Acepta archivo vía campo alternativo 'archivo' en FormData con contrato dual", async () => {
    const token = await createSessionToken(tecnicoAssigned);
    const formData = new FormData();
    const fakeFile = new File([Buffer.from("%PDF-1.4 test document 2")], "informe_campo.pdf", {
      type: "application/pdf",
    });
    formData.append("archivo", fakeFile);

    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      data: { nombre_archivo: string; tipo_mime: string };
      evidencias_adjuntas: Array<{ nombre_archivo: string; tipo_mime: string }>;
    };
    assert.equal(body.data.nombre_archivo, "informe_campo.pdf");
    assert.equal(body.data.tipo_mime, "application/pdf");
    assert.ok(Array.isArray(body.evidencias_adjuntas));
    assert.equal(body.evidencias_adjuntas.length, 1);
    assert.equal(body.evidencias_adjuntas[0].nombre_archivo, "informe_campo.pdf");
  });

  test("5. Retorna HTTP 503 cuando Supabase Storage no está configurado en el servidor", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const token = await createSessionToken(reportanteOwner);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nombre_archivo: "prueba.png",
        tipo_mime: "image/png",
        contenido_base64: Buffer.from("png").toString("base64"),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /no está configurado/i);
  });

  test("5. Retorna HTTP 502 cuando la carga física a Supabase Storage falla", async () => {
    shouldFailSupabase = true;

    const token = await createSessionToken(reportanteOwner);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nombre_archivo: "prueba.png",
        tipo_mime: "image/png",
        contenido_base64: Buffer.from("png").toString("base64"),
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 502);
  });

  // ==========================================================================
  // 6. CONSULTA DE EVIDENCIAS (GET /api/incidencias/[id]/evidencias)
  // ==========================================================================
  test("6. GET - Rechaza consulta sin sesión con HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "GET",
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 401);
  });

  test("6. GET - Rechaza con HTTP 403 si un reportante intenta consultar evidencias de un ticket ajeno", async () => {
    const token = await createSessionToken(reportanteOther);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /expediente ajeno/i);
  });

  test("6. GET - Rechaza con HTTP 403 si un técnico no asignado intenta consultar evidencias", async () => {
    const token = await createSessionToken(tecnicoOther);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /técnico asignado/i);
  });

  test("6. GET - Retorna HTTP 404 si la incidencia no existe", async () => {
    const token = await createSessionToken(reportanteOwner);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc999999999999999999/evidencias", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc999999999999999999" }) });
    assert.equal(res.status, 404);
  });

  test("6. GET - Reportante dueño consulta evidencias y obtiene URLs firmadas exitosamente (HTTP 200)", async () => {
    const doc = sampleIncidencia({
      evidencias_adjuntas: [
        {
          nombre_archivo: "falla_puerto.png",
          tipo_mime: "image/png",
          peso_kb: 120,
          storage_key: "evidencias-utm/65fabc1234567890abcdef01/falla_puerto.png",
          fecha_carga: new Date("2026-10-28T10:00:00.000Z"),
        },
      ],
    });
    mockDbStorage.set(String(doc._id), doc);

    const token = await createSessionToken(reportanteOwner);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      evidencias_adjuntas: Array<{
        nombre_archivo: string;
        tipo_mime: string;
        peso_kb: number;
        storage_key?: string;
        url_firmada?: string;
        fecha_carga: string;
      }>;
    };

    assert.ok(Array.isArray(body.evidencias_adjuntas));
    assert.equal(body.evidencias_adjuntas.length, 1);
    assert.equal(body.evidencias_adjuntas[0].nombre_archivo, "falla_puerto.png");
    assert.equal(body.evidencias_adjuntas[0].tipo_mime, "image/png");
    assert.ok(body.evidencias_adjuntas[0].url_firmada?.includes("token=signed123"));
  });

  test("6. GET - Coordinador consulta evidencias de cualquier incidencia exitosamente", async () => {
    const doc = sampleIncidencia({
      evidencias_adjuntas: [
        {
          nombre_archivo: "red_topo.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 500,
          storage_key: "evidencias-utm/65fabc1234567890abcdef01/red_topo.pdf",
          fecha_carga: new Date("2026-10-28T11:00:00.000Z"),
        },
      ],
    });
    mockDbStorage.set(String(doc._id), doc);

    const token = await createSessionToken(coordinadorUser);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      evidencias_adjuntas: Array<{ nombre_archivo: string; url_firmada?: string }>;
    };
    assert.equal(body.evidencias_adjuntas.length, 1);
    assert.equal(body.evidencias_adjuntas[0].nombre_archivo, "red_topo.pdf");
    assert.ok(body.evidencias_adjuntas[0].url_firmada?.includes("token=signed123"));
  });

  test("6. GET - Técnico asignado consulta evidencias exitosamente", async () => {
    const doc = sampleIncidencia({
      evidencias_adjuntas: [
        {
          nombre_archivo: "diagnostico_final.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 300,
          storage_key: "evidencias-utm/65fabc1234567890abcdef01/diagnostico_final.pdf",
          fecha_carga: new Date("2026-10-28T12:00:00.000Z"),
        },
      ],
    });
    mockDbStorage.set(String(doc._id), doc);

    const token = await createSessionToken(tecnicoAssigned);
    const req = new Request("http://localhost:3000/api/incidencias/65fabc1234567890abcdef01/evidencias", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "65fabc1234567890abcdef01" }) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      evidencias_adjuntas: Array<{ nombre_archivo: string; url_firmada?: string }>;
    };
    assert.equal(body.evidencias_adjuntas.length, 1);
    assert.equal(body.evidencias_adjuntas[0].nombre_archivo, "diagnostico_final.pdf");
  });
});
