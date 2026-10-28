/**
 * Script Maestro de Inicialización y Poblado (Seed)
 * UTM Desk NoSQL Cloud — Proyecto de Unidad II
 * Responsable Backend 1: Angel Gabriel Noh Camargo
 *
 * Funciones principales:
 * 1. Conexión segura a MongoDB Atlas y Upstash Redis.
 * 2. Creación idempotente de colecciones con validadores formales $jsonSchema (polimorfismo con oneOf).
 * 3. Creación de índices estratégicos (Compuesto, TTL de 60 días, Full-Text ponderado en español, etc.).
 * 4. Poblado idempotente de 5 roles de usuario RBAC con contraseñas cifradas vía bcrypt.
 * 5. Poblado idempotente de 25 incidencias sintéticas balanceadas (mínimo 4 edificios, 8 resueltas, 15 con evidencias).
 * 6. Inicialización atómica y segura del contador de Redis (contador:incidencias:2026).
 * 7. Resumen de verificaciones de auditoría.
 */

import path from "path";
import dotenv from "dotenv";
import { MongoClient, type Db } from "mongodb";
import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { ensureCounterAtLeast } from "../lib/redis";

// Cargar variables de entorno explícitamente desde .env.local con fallback a .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "utm_desk_db";
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;
const ANIO_ACTUAL = 2026;

// ============================================================================
// 1. ESQUEMAS DE VALIDACIÓN FORMAL ($jsonSchema) SEGÚN ESPECIFICACIÓN OFICIAL
// ============================================================================

const usuariosSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "id_usuario",
      "nombre",
      "correo",
      "password_hash",
      "rol",
      "departamento",
      "activo",
      "fecha_registro",
    ],
    properties: {
      id_usuario: { bsonType: "string", minLength: 3 },
      nombre: { bsonType: "string", minLength: 5 },
      correo: { bsonType: "string", pattern: "^.+@utm\\.edu\\.mx$" },
      password_hash: { bsonType: "string" },
      rol: {
        enum: ["admin", "directiva", "coordinador", "tecnico", "reportante"],
      },
      rol_institucional: {
        enum: ["Docente", "Estudiante", "Administrativo"],
      },
      area_asignada: {
        enum: ["computo_redes", "infraestructura", "academico"],
      },
      departamento: { bsonType: "string" },
      activo: { bsonType: "bool" },
      fecha_registro: { bsonType: "date" },
    },
    oneOf: [
      {
        properties: { rol: { enum: ["tecnico"] } },
        required: ["area_asignada"],
      },
      {
        properties: { rol: { enum: ["reportante"] } },
        required: ["rol_institucional"],
      },
      {
        properties: { rol: { enum: ["admin", "directiva", "coordinador"] } },
      },
    ],
  },
};

const incidenciasCampusSchema = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "folio",
      "titulo",
      "descripcion",
      "categoria",
      "prioridad",
      "estado",
      "horas_invertidas",
      "fecha_creacion",
      "reportante",
      "ubicacion",
      "detalle_especifico",
      "tags",
      "historial_seguimiento",
      "evidencias_adjuntas",
    ],
    properties: {
      folio: { bsonType: "string", pattern: "^INC-[0-9]{4}-[0-9]{4}$" },
      titulo: { bsonType: "string", minLength: 10, maxLength: 150 },
      descripcion: { bsonType: "string", minLength: 15 },
      categoria: { enum: ["computo_redes", "infraestructura", "academico"] },
      prioridad: { enum: ["baja", "media", "alta", "critica"] },
      estado: {
        enum: ["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"],
      },
      horas_invertidas: { bsonType: ["double", "int"], minimum: 0 },
      fecha_creacion: { bsonType: "date" },
      fecha_resolucion: { bsonType: "date" },
      reportante: {
        bsonType: "object",
        required: ["id_usuario", "nombre", "rol_institucional", "correo"],
        properties: {
          id_usuario: { bsonType: "string" },
          nombre: { bsonType: "string" },
          rol_institucional: {
            enum: ["Docente", "Estudiante", "Administrativo"],
          },
          correo: { bsonType: "string" },
        },
      },
      tecnico_asignado: {
        bsonType: "object",
        required: ["id_usuario", "nombre", "correo", "area"],
        properties: {
          id_usuario: { bsonType: "string" },
          nombre: { bsonType: "string" },
          correo: { bsonType: "string" },
          area: { enum: ["computo_redes", "infraestructura", "academico"] },
        },
      },
      ubicacion: {
        bsonType: "object",
        required: ["edificio", "piso", "aula_laboratorio"],
        properties: {
          edificio: { bsonType: "string" },
          piso: { bsonType: "string" },
          aula_laboratorio: { bsonType: "string" },
        },
      },
      tags: {
        bsonType: "array",
        items: { bsonType: "string" },
      },
      historial_seguimiento: {
        bsonType: "array",
        minItems: 1,
        items: {
          bsonType: "object",
          required: [
            "fecha",
            "autor",
            "estado_nuevo",
            "horas_sumadas",
            "comentario",
          ],
          properties: {
            fecha: { bsonType: "date" },
            autor: { bsonType: "string" },
            estado_nuevo: {
              enum: ["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"],
            },
            horas_sumadas: { bsonType: ["double", "int"], minimum: 0 },
            comentario: { bsonType: "string" },
          },
        },
      },
      evidencias_adjuntas: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: [
            "nombre_archivo",
            "tipo_mime",
            "peso_kb",
            "storage_key",
            "fecha_carga",
          ],
          properties: {
            nombre_archivo: { bsonType: "string" },
            tipo_mime: {
              enum: ["image/png", "image/jpeg", "application/pdf"],
            },
            peso_kb: {
              bsonType: ["double", "int"],
              minimum: 0,
              maximum: 5120,
            },
            storage_key: { bsonType: "string" },
            fecha_carga: { bsonType: "date" },
          },
        },
      },
    },
    oneOf: [
      {
        required: ["categoria", "detalle_especifico"],
        properties: {
          categoria: { enum: ["computo_redes"] },
          detalle_especifico: {
            bsonType: "object",
            required: [
              "direccion_ip",
              "vlan",
              "puerto_uplink",
              "equipos_afectados",
            ],
            additionalProperties: false,
            properties: {
              direccion_ip: { bsonType: "string" },
              vlan: { bsonType: "int", minimum: 1, maximum: 4094 },
              puerto_uplink: { bsonType: "string" },
              equipos_afectados: { bsonType: "int", minimum: 1 },
            },
          },
        },
      },
      {
        required: ["categoria", "detalle_especifico"],
        properties: {
          categoria: { enum: ["infraestructura"] },
          detalle_especifico: {
            bsonType: "object",
            required: [
              "tipo_dano",
              "riesgo_seguridad",
              "requiere_insumos",
              "contratista_externo",
            ],
            additionalProperties: false,
            properties: {
              tipo_dano: { bsonType: "string" },
              riesgo_seguridad: { enum: ["Bajo", "Medio", "Alto", "Critico"] },
              requiere_insumos: { bsonType: "bool" },
              insumos_solicitados: {
                bsonType: "array",
                items: { bsonType: "string" },
              },
              contratista_externo: { bsonType: "bool" },
            },
          },
        },
      },
      {
        required: ["categoria", "detalle_especifico"],
        properties: {
          categoria: { enum: ["academico"] },
          detalle_especifico: {
            bsonType: "object",
            required: [
              "plataforma",
              "codigo_curso",
              "periodo_escolar",
              "estudiantes_impactados",
            ],
            additionalProperties: false,
            properties: {
              plataforma: { bsonType: "string" },
              codigo_curso: { bsonType: "string" },
              periodo_escolar: { bsonType: "string" },
              estudiantes_impactados: { bsonType: "int", minimum: 1 },
            },
          },
        },
      },
    ],
  },
};

// ============================================================================
// 2. APLICAR VALIDADORES DE FORMA IDEMPOTENTE
// ============================================================================

async function ensureCollectionWithValidator(
  db: Db,
  collectionName: string,
  validatorConfig: object
) {
  const existing = await db
    .listCollections({ name: collectionName })
    .toArray();

  if (existing.length === 0) {
    console.log(`[MongoDB] Creando colección '${collectionName}' con $jsonSchema...`);
    await db.createCollection(collectionName, {
      validator: validatorConfig,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    console.log(`[MongoDB] Colección '${collectionName}' ya existe. Actualizando validador con collMod...`);
    await db.command({
      collMod: collectionName,
      validator: validatorConfig,
      validationLevel: "strict",
      validationAction: "error",
    });
  }
}

// ============================================================================
// 3. CREAR ÍNDICES IDEMPOTENTES
// ============================================================================

async function setupIndexes(db: Db) {
  console.log("[MongoDB] Verificando y creando índices en 'usuarios'...");
  const colUsuarios = db.collection("usuarios");
  const existingUserIndexes = await colUsuarios.indexes();

  const userIndexNames = new Set(existingUserIndexes.map((idx) => idx.name));

  if (!userIndexNames.has("idx_usuarios_correo_unico")) {
    await colUsuarios.createIndex(
      { correo: 1 },
      { unique: true, name: "idx_usuarios_correo_unico" }
    );
  }
  if (!userIndexNames.has("idx_usuarios_clave_unica")) {
    await colUsuarios.createIndex(
      { id_usuario: 1 },
      { unique: true, name: "idx_usuarios_clave_unica" }
    );
  }
  if (!userIndexNames.has("idx_usuarios_rol_area")) {
    await colUsuarios.createIndex(
      { rol: 1, area_asignada: 1 },
      { name: "idx_usuarios_rol_area" }
    );
  }

  console.log("[MongoDB] Verificando y creando índices en 'incidencias_campus'...");
  const colIncidencias = db.collection("incidencias_campus");
  const existingIncIndexes = await colIncidencias.indexes();
  const incIndexNames = new Set(existingIncIndexes.map((idx) => idx.name));

  // 1. Índice Compuesto Obligatorio
  if (!incIndexNames.has("idx_compuesto_cat_est_edif")) {
    await colIncidencias.createIndex(
      { categoria: 1, estado: 1, "ubicacion.edificio": 1 },
      { name: "idx_compuesto_cat_est_edif" }
    );
  }

  // 2. Índice TTL Obligatorio (60 días = 5184000 segundos sobre fecha_resolucion)
  if (!incIndexNames.has("idx_ttl_resolucion_60dias")) {
    await colIncidencias.createIndex(
      { fecha_resolucion: 1 },
      { expireAfterSeconds: 5184000, name: "idx_ttl_resolucion_60dias" }
    );
  }

  // 3. Índice Full-Text Obligatorio ponderado en español
  if (!incIndexNames.has("idx_fulltext_es_ponderado")) {
    await colIncidencias.createIndex(
      { titulo: "text", descripcion: "text" },
      {
        default_language: "spanish",
        weights: { titulo: 10, descripcion: 5 },
        name: "idx_fulltext_es_ponderado",
      }
    );
  }

  // 4. Índices Auxiliares Oficiales
  if (!incIndexNames.has("idx_folio_unico")) {
    await colIncidencias.createIndex(
      { folio: 1 },
      { unique: true, name: "idx_folio_unico" }
    );
  }
  if (!incIndexNames.has("idx_reportante_usuario")) {
    await colIncidencias.createIndex(
      { "reportante.id_usuario": 1 },
      { name: "idx_reportante_usuario" }
    );
  }
  // Índices auxiliares optimizados con justificación operativa:
  // - idx_tecnico_estado: acelera las consultas de técnicos filtrando sus tareas asignadas por estado activo
  if (!incIndexNames.has("idx_tecnico_estado")) {
    await colIncidencias.createIndex(
      { "tecnico_asignado.id_usuario": 1, estado: 1 },
      { name: "idx_tecnico_estado" }
    );
  }
  // - idx_reportante_fecha: acelera el listado cronológico de incidencias propias en /mis-incidencias
  if (!incIndexNames.has("idx_reportante_fecha")) {
    await colIncidencias.createIndex(
      { "reportante.id_usuario": 1, fecha_creacion: -1 },
      { name: "idx_reportante_fecha" }
    );
  }
}

// ============================================================================
// 4. SEMBRAR USUARIOS DE DEMOSTRACIÓN (RBAC COMPLETO)
// ============================================================================

interface UsuarioSeed {
  id_usuario: string;
  nombre: string;
  correo: string;
  password_hash: string;
  rol: "admin" | "directiva" | "coordinador" | "tecnico" | "reportante";
  rol_institucional?: "Docente" | "Estudiante" | "Administrativo";
  area_asignada?: "computo_redes" | "infraestructura" | "academico";
  departamento: string;
  activo: boolean;
  fecha_registro: Date;
}

async function seedUsuarios(db: Db): Promise<{ inserted: number; skipped: number }> {
  console.log("[MongoDB] Procesando sembrado de usuarios RBAC...");
  if (!SEED_DEFAULT_PASSWORD) {
    throw new Error("[Seguridad] SEED_DEFAULT_PASSWORD no está configurada en el entorno.");
  }
  const colUsuarios = db.collection<UsuarioSeed>("usuarios");
  const hashedPw = await bcrypt.hash(SEED_DEFAULT_PASSWORD, 10);
  const now = new Date();

  const usuariosData: UsuarioSeed[] = [
    {
      id_usuario: "ADM-0311",
      nombre: "Carlos Méndez Cetina",
      correo: "carlos.mendez@utm.edu.mx",
      password_hash: hashedPw,
      rol: "admin",
      departamento: "Dirección de Tecnologías de la Información",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "DIR-0014",
      nombre: "Dra. Carmen Solís Pech",
      correo: "carmen.solis@utm.edu.mx",
      password_hash: hashedPw,
      rol: "directiva",
      departamento: "Rectoría UTM",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "CRD-0105",
      nombre: "Ing. Luis Briceño Tun",
      correo: "luis.briceno@utm.edu.mx",
      password_hash: hashedPw,
      rol: "coordinador",
      departamento: "Coordinación de Operaciones de Campus",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "TEC-0205",
      nombre: "Ing. Roberto Pech Moo",
      correo: "roberto.pech@utm.edu.mx",
      password_hash: hashedPw,
      rol: "tecnico",
      area_asignada: "computo_redes",
      departamento: "Cómputo y Telecomunicaciones",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "TEC-0412",
      nombre: "Téc. Miguel Balam Dzib",
      correo: "miguel.balam@utm.edu.mx",
      password_hash: hashedPw,
      rol: "tecnico",
      area_asignada: "infraestructura",
      departamento: "Mantenimiento e Infraestructura Física",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "TEC-0518",
      nombre: "Lic. Sofía Ortiz Lara",
      correo: "sofia.ortiz@utm.edu.mx",
      password_hash: hashedPw,
      rol: "tecnico",
      area_asignada: "academico",
      departamento: "Servicios Escolares y Plataformas Académicas",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "DOC-1042",
      nombre: "Mtro. Carlos Méndez Cetina",
      correo: "carlos.docente@utm.edu.mx",
      password_hash: hashedPw,
      rol: "reportante",
      rol_institucional: "Docente",
      departamento: "División de Tecnologías de la Información",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "ADM-0422",
      nombre: "Lic. Laura Canto Várguez",
      correo: "laura.canto@utm.edu.mx",
      password_hash: hashedPw,
      rol: "reportante",
      rol_institucional: "Administrativo",
      departamento: "Servicios Escolares",
      activo: true,
      fecha_registro: now,
    },
    {
      id_usuario: "EST-2024",
      nombre: "Alejandro Pérez Noh",
      correo: "alejandro.perez@utm.edu.mx",
      password_hash: hashedPw,
      rol: "reportante",
      rol_institucional: "Estudiante",
      departamento: "Ingeniería en Desarrollo de Software",
      activo: true,
      fecha_registro: now,
    },
  ];

  let inserted = 0;
  let skipped = 0;

  for (const user of usuariosData) {
    const existing = await colUsuarios.findOne({
      $or: [{ id_usuario: user.id_usuario }, { correo: user.correo }],
    });
    if (!existing) {
      await colUsuarios.insertOne(user);
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

// ============================================================================
// 5. SEMBRAR 25 INCIDENCIAS SINTÉTICAS BALANCEADAS
// ============================================================================

export interface IncidenciaSeedDoc {
  folio: string;
  titulo: string;
  descripcion: string;
  categoria: "computo_redes" | "infraestructura" | "academico";
  prioridad: "baja" | "media" | "alta" | "critica";
  estado: "abierta" | "en_proceso" | "en_espera" | "resuelta" | "cerrada";
  horas_invertidas: number;
  fecha_creacion: Date;
  fecha_resolucion?: Date;
  reportante: {
    id_usuario: string;
    nombre: string;
    rol_institucional: "Docente" | "Estudiante" | "Administrativo";
    correo: string;
  };
  tecnico_asignado?: {
    id_usuario: string;
    nombre: string;
    correo: string;
    area: "computo_redes" | "infraestructura" | "academico";
  };
  ubicacion: {
    edificio: string;
    piso: string;
    aula_laboratorio: string;
  };
  detalle_especifico:
    | {
        direccion_ip: string;
        vlan: number;
        puerto_uplink: string;
        equipos_afectados: number;
      }
    | {
        tipo_dano: string;
        riesgo_seguridad: "Bajo" | "Medio" | "Alto" | "Critico";
        requiere_insumos: boolean;
        insumos_solicitados: string[];
        contratista_externo: boolean;
      }
    | {
        plataforma: string;
        codigo_curso: string;
        periodo_escolar: string;
        estudiantes_impactados: number;
      };
  tags: string[];
  historial_seguimiento: Array<{
    fecha: Date;
    autor: string;
    estado_nuevo: "abierta" | "en_proceso" | "en_espera" | "resuelta" | "cerrada";
    horas_sumadas: number;
    comentario: string;
  }>;
  evidencias_adjuntas: Array<{
    nombre_archivo: string;
    tipo_mime: "image/png" | "image/jpeg" | "application/pdf";
    peso_kb: number;
    storage_key: string;
    fecha_carga: Date;
  }>;
}

export function buildSyntheticIncidents(baseDate: Date = new Date()): IncidenciaSeedDoc[] {
  // Conversión dinámica de fechas relativas a Date.now():
  // Mapea linealmente el rango original de simulación (5 al 17 de octubre de 2026)
  // para que las incidencias resueltas queden entre 1 y 8 días atrás del momento
  // de ejecución. De esta forma, el índice TTL de MongoDB (60 días = 5,184,000s sobre fecha_resolucion)
  // las conserva intactas hasta finales de diciembre de 2026 (> 15 de diciembre de 2026).
  const tMin = new Date("2026-10-05T00:00:00Z").getTime();
  const tMax = new Date("2026-10-17T12:00:00Z").getTime();
  const span = tMax - tMin;

  const d = (iso: string): Date => {
    const t = new Date(iso).getTime();
    const progress = Math.max(0, Math.min(1, (t - tMin) / span));
    const daysAgo = 8.0 - progress * 7.0; // Rango de 8 a 1 días atrás
    return new Date(baseDate.getTime() - Math.round(daysAgo * 86400000));
  };

  return [
    // ------------------------------------------------------------------------
    // CÓMPUTO Y REDES (9 Incidencias: 3 resueltas, 6 con evidencias)
    // ------------------------------------------------------------------------
    {
      folio: "INC-2026-0001",
      titulo: "Caída de enlace trunk en switch de Laboratorio de Redes Cisco",
      descripcion: "Los equipos del laboratorio perdieron salida a internet y acceso al servidor DHCP local tras corte eléctrico.",
      categoria: "computo_redes",
      prioridad: "critica",
      estado: "resuelta",
      horas_invertidas: 3.5,
      fecha_creacion: d("2026-10-10T08:00:00Z"),
      fecha_resolucion: d("2026-10-10T11:30:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Alta",
        aula_laboratorio: "Laboratorio de Redes K-204",
      },
      detalle_especifico: {
        direccion_ip: "192.168.20.254",
        vlan: 20,
        puerto_uplink: "GigabitEthernet0/1",
        equipos_afectados: 32,
      },
      tags: ["switch-cisco", "vlan-20", "sin-red", "uplink-caido"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-10T08:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Incidencia registrada e inicializada en plataforma.",
        },
        {
          fecha: d("2026-10-10T08:30:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "en_proceso",
          horas_sumadas: 1.0,
          comentario: "Se detectó transceptor SFP dañado por sobretensión.",
        },
        {
          fecha: d("2026-10-10T11:30:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "resuelta",
          horas_sumadas: 2.5,
          comentario: "Reemplazo de módulo de fibra y restauración de conectividad VLAN 20.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "diagnostico_switch_k204.png",
          tipo_mime: "image/png",
          peso_kb: 420.5,
          storage_key: "evidencias-utm/2026/computo_redes/INC-2026-0001/diagnostico_switch_k204.png",
          fecha_carga: d("2026-10-10T08:45:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0002",
      titulo: "Saturación de ancho de banda y colisión en Access Point de Biblioteca",
      descripcion: "Usuarios reportan latencia mayor a 800ms y desconexión continua de dispositivos móviles.",
      categoria: "computo_redes",
      prioridad: "alta",
      estado: "resuelta",
      horas_invertidas: 2.0,
      fecha_creacion: d("2026-10-11T09:15:00Z"),
      fecha_resolucion: d("2026-10-11T11:15:00Z"),
      reportante: {
        id_usuario: "EST-2024",
        nombre: "Alejandro Pérez Noh",
        rol_institucional: "Estudiante",
        correo: "alejandro.perez@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio L - Idiomas y Biblioteca",
        piso: "Planta Baja",
        aula_laboratorio: "Sala de Lectura General",
      },
      detalle_especifico: {
        direccion_ip: "10.15.100.12",
        vlan: 100,
        puerto_uplink: "FastEthernet0/12",
        equipos_afectados: 65,
      },
      tags: ["wifi-utm", "access-point", "latencia", "biblioteca"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-11T09:15:00Z"),
          autor: "Alejandro Pérez Noh",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Imposible conectarse a la red estudiantil.",
        },
        {
          fecha: d("2026-10-11T11:15:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "resuelta",
          horas_sumadas: 2.0,
          comentario: "Ajuste de canales en 5GHz y balanceo de carga entre APs.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "ping_latencia_wifi.png",
          tipo_mime: "image/png",
          peso_kb: 310.2,
          storage_key: "evidencias-utm/2026/computo_redes/INC-2026-0002/ping_latencia_wifi.png",
          fecha_carga: d("2026-10-11T09:30:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0003",
      titulo: "Fallo de conexión DHCP en laboratorio de cómputo avanzado",
      descripcion: "Las estaciones de trabajo no obtienen concesión IP dinámica y asignan direcciones APIPA 169.254.x.x.",
      categoria: "computo_redes",
      prioridad: "media",
      estado: "resuelta",
      horas_invertidas: 1.5,
      fecha_creacion: d("2026-10-12T10:00:00Z"),
      fecha_resolucion: d("2026-10-12T11:30:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Primer Piso",
        aula_laboratorio: "Laboratorio C-102",
      },
      detalle_especifico: {
        direccion_ip: "192.168.30.1",
        vlan: 30,
        puerto_uplink: "GigabitEthernet0/24",
        equipos_afectados: 25,
      },
      tags: ["dhcp", "ip-config", "sin-conexion"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-12T10:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Máquinas con error de red en inicio de clase.",
        },
        {
          fecha: d("2026-10-12T11:30:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "resuelta",
          horas_sumadas: 1.5,
          comentario: "Reinicio del servicio isc-dhcp-server y renovación de leases.",
        },
      ],
      evidencias_adjuntas: [],
    },
    {
      folio: "INC-2026-0004",
      titulo: "Cableado estructurado dañado en rack de servidores de Rectoría",
      descripcion: "Patch cord de fibra presenta curvatura crítica provocando pérdida de paquetes hacia el conmutador telefónico.",
      categoria: "computo_redes",
      prioridad: "critica",
      estado: "en_proceso",
      horas_invertidas: 2.0,
      fecha_creacion: d("2026-10-13T08:30:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio A - Rectoría y Auditorios",
        piso: "Planta Baja",
        aula_laboratorio: "Site de Comunicaciones A-01",
      },
      detalle_especifico: {
        direccion_ip: "10.0.1.1",
        vlan: 1,
        puerto_uplink: "TenGigabit0/1",
        equipos_afectados: 12,
      },
      tags: ["fibra-optica", "rack-rectoria", "telefonia-ip"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-13T08:30:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Reporte de conmutador intermitente.",
        },
        {
          fecha: d("2026-10-13T09:00:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "en_proceso",
          horas_sumadas: 2.0,
          comentario: "En espera de nuevo jumper monomodo LC-LC.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "jumper_fibra_danado.jpg",
          tipo_mime: "image/jpeg",
          peso_kb: 1280.0,
          storage_key: "evidencias-utm/2026/computo_redes/INC-2026-0004/jumper_fibra_danado.jpg",
          fecha_carga: d("2026-10-13T09:10:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0005",
      titulo: "Bucle de capa 2 por conexión indebida en Laboratorio de Redes K-202",
      descripcion: "Tormenta de broadcast colapsó switch perimetral tras conectar ambos extremos de un cable al mismo panel.",
      categoria: "computo_redes",
      prioridad: "alta",
      estado: "abierta",
      horas_invertidas: 0.5,
      fecha_creacion: d("2026-10-14T12:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Alta",
        aula_laboratorio: "Laboratorio K-202",
      },
      detalle_especifico: {
        direccion_ip: "192.168.22.1",
        vlan: 22,
        puerto_uplink: "GigabitEthernet0/8",
        equipos_afectados: 30,
      },
      tags: ["spanning-tree", "broadcast-storm", "bucle-l2"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-14T12:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0.5,
          comentario: "Leds del switch parpadeando de forma continua al 100%.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "captura_wireshark_storm.png",
          tipo_mime: "image/png",
          peso_kb: 512.0,
          storage_key: "evidencias-utm/2026/computo_redes/INC-2026-0005/captura_wireshark_storm.png",
          fecha_carga: d("2026-10-14T12:15:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0006",
      titulo: "Falla de alimentación PoE en cámaras de seguridad perimetrales",
      descripcion: "Switch PoE no suministra energía suficiente a las cámaras del estacionamiento norte.",
      categoria: "computo_redes",
      prioridad: "media",
      estado: "en_espera",
      horas_invertidas: 1.0,
      fecha_creacion: d("2026-10-15T07:45:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio B - Ciencias Básicas",
        piso: "Planta Baja",
        aula_laboratorio: "Cabina de Monitoreo B-02",
      },
      detalle_especifico: {
        direccion_ip: "10.50.0.15",
        vlan: 50,
        puerto_uplink: "GigabitEthernet0/16",
        equipos_afectados: 6,
      },
      tags: ["poe", "cctv", "seguridad-campus"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-15T07:45:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Cámaras sin señal de video.",
        },
        {
          fecha: d("2026-10-15T09:00:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "en_espera",
          horas_sumadas: 1.0,
          comentario: "En espera de inyector PoE industrial de repuesto.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "diagnostico_poe_power.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 450.0,
          storage_key: "evidencias-utm/2026/computo_redes/INC-2026-0006/diagnostico_poe_power.pdf",
          fecha_carga: d("2026-10-15T09:15:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0007",
      titulo: "Intermitencia en gateway DNS corporativo para edificios docentes",
      descripcion: "Resolución de nombres lenta hacia dominios educativos externos e internos.",
      categoria: "computo_redes",
      prioridad: "baja",
      estado: "cerrada",
      horas_invertidas: 2.0,
      fecha_creacion: d("2026-10-05T14:00:00Z"),
      fecha_resolucion: d("2026-10-05T16:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Segundo Piso",
        aula_laboratorio: "Cubículo Docente C-205",
      },
      detalle_especifico: {
        direccion_ip: "10.0.0.53",
        vlan: 10,
        puerto_uplink: "GigabitEthernet0/2",
        equipos_afectados: 120,
      },
      tags: ["dns", "bind9", "cache-dns"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-05T14:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Fallo intermitente al abrir páginas externas.",
        },
        {
          fecha: d("2026-10-05T16:00:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "cerrada",
          horas_sumadas: 2.0,
          comentario: "Purga de tabla DNS forwarder y actualización de upstream servidores.",
        },
      ],
      evidencias_adjuntas: [],
    },
    {
      folio: "INC-2026-0008",
      titulo: "Caída de servicio proxy Squid en sala de cómputo para certificaciones",
      descripcion: "Alumnos no pueden acceder al examen de certificación debido a fallo en autenticación del proxy.",
      categoria: "computo_redes",
      prioridad: "critica",
      estado: "en_proceso",
      horas_invertidas: 1.5,
      fecha_creacion: d("2026-10-16T10:10:00Z"),
      reportante: {
        id_usuario: "EST-2024",
        nombre: "Alejandro Pérez Noh",
        rol_institucional: "Estudiante",
        correo: "alejandro.perez@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0205",
        nombre: "Ing. Roberto Pech Moo",
        correo: "roberto.pech@utm.edu.mx",
        area: "computo_redes",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Baja",
        aula_laboratorio: "Laboratorio K-101",
      },
      detalle_especifico: {
        direccion_ip: "192.168.101.5",
        vlan: 101,
        puerto_uplink: "GigabitEthernet0/20",
        equipos_afectados: 40,
      },
      tags: ["proxy", "squid", "certificacion", "bloqueo-web"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-16T10:10:00Z"),
          autor: "Alejandro Pérez Noh",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Navegadores muestran error 504 Gateway Timeout.",
        },
        {
          fecha: d("2026-10-16T10:40:00Z"),
          autor: "Ing. Roberto Pech Moo",
          estado_nuevo: "en_proceso",
          horas_sumadas: 1.5,
          comentario: "Bypass temporal configurado mientras se repara servicio LDAP del proxy.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "squid_access_log.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 890.0,
          storage_key: "evidencias-utm/2026/computo_redes/INC-2026-0008/squid_access_log.pdf",
          fecha_carga: d("2026-10-16T10:30:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0009",
      titulo: "Fallo en tarjeta de red Gigabit de workstation docente en cubículo C-301",
      descripcion: "La tarjeta de red PCIe perdió el enlace físico a 1000 Mbps y opera intermitentemente a 10 Mbps half-duplex.",
      categoria: "computo_redes",
      prioridad: "baja",
      estado: "abierta",
      horas_invertidas: 0,
      fecha_creacion: d("2026-10-17T11:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Segundo Piso",
        aula_laboratorio: "Cubículo Docente C-301",
      },
      detalle_especifico: {
        direccion_ip: "192.168.10.88",
        vlan: 10,
        puerto_uplink: "GigabitEthernet0/14",
        equipos_afectados: 1,
      },
      tags: ["tarjeta-red", "nic", "half-duplex"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-17T11:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Transferencia de archivos a servidor institucional extremadamente lenta.",
        },
      ],
      evidencias_adjuntas: [],
    },

    // ------------------------------------------------------------------------
    // INFRAESTRUCTURA FÍSICA (8 Incidencias: 3 resueltas, 6 con evidencias)
    // ------------------------------------------------------------------------
    {
      folio: "INC-2026-0010",
      titulo: "Filtración de agua en plafón y falla de luminarias en Aula Magna",
      descripcion: "Humedad acumulada por lluvias provoca goteo constante cerca del proyector central y corto en dos lámparas LED.",
      categoria: "infraestructura",
      prioridad: "alta",
      estado: "resuelta",
      horas_invertidas: 6.0,
      fecha_creacion: d("2026-10-10T09:00:00Z"),
      fecha_resolucion: d("2026-10-12T15:30:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0412",
        nombre: "Téc. Miguel Balam Dzib",
        correo: "miguel.balam@utm.edu.mx",
        area: "infraestructura",
      },
      ubicacion: {
        edificio: "Edificio A - Rectoría y Auditorios",
        piso: "Planta Baja",
        aula_laboratorio: "Aula Magna A-101",
      },
      detalle_especifico: {
        tipo_dano: "Hidrosanitario y Eléctrico",
        riesgo_seguridad: "Alto",
        requiere_insumos: true,
        insumos_solicitados: [
          "Sellador elastomérico",
          "2 Paneles LED 60x60cm",
          "Plafón reticular",
        ],
        contratista_externo: false,
      },
      tags: ["filtracion-techo", "luminaria-led", "riesgo-electrico"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-10T09:00:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Ticket creado con prioridad alta.",
        },
        {
          fecha: d("2026-10-10T09:40:00Z"),
          autor: "Ing. Luis Briceño Tun",
          estado_nuevo: "en_proceso",
          horas_sumadas: 0,
          comentario: "Asignado a Téc. Miguel Balam Dzib.",
        },
        {
          fecha: d("2026-10-12T15:30:00Z"),
          autor: "Téc. Miguel Balam Dzib",
          estado_nuevo: "resuelta",
          horas_sumadas: 6.0,
          comentario: "Se impermeabilizó losa superior y se reemplazaron las luminarias y plafones dañados.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "reparacion_plafon_a101.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 890.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0010/reparacion_plafon_a101.pdf",
          fecha_carga: d("2026-10-12T15:25:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0011",
      titulo: "Falla de compresor en equipo de aire acondicionado MiniSplit inverter",
      descripcion: "El equipo presenta bloqueo térmico emitiendo código de error E6 y calentamiento excesivo en aula.",
      categoria: "infraestructura",
      prioridad: "alta",
      estado: "resuelta",
      horas_invertidas: 4.0,
      fecha_creacion: d("2026-10-11T13:00:00Z"),
      fecha_resolucion: d("2026-10-13T10:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0412",
        nombre: "Téc. Miguel Balam Dzib",
        correo: "miguel.balam@utm.edu.mx",
        area: "infraestructura",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Alta",
        aula_laboratorio: "Aula K-203",
      },
      detalle_especifico: {
        tipo_dano: "Climatización y Termomecánica",
        riesgo_seguridad: "Medio",
        requiere_insumos: true,
        insumos_solicitados: ["Gas refrigerante R410A", "Capacitor de arranque 35uF"],
        contratista_externo: false,
      },
      tags: ["clima", "minisplit", "sobrecalentamiento"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-11T13:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Aula sin clima con 35 alumnos en clase.",
        },
        {
          fecha: d("2026-10-13T10:00:00Z"),
          autor: "Téc. Miguel Balam Dzib",
          estado_nuevo: "resuelta",
          horas_sumadas: 4.0,
          comentario: "Sustitución de capacitor y recarga de refrigerante.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "evidencia_capacitor_quemado.jpg",
          tipo_mime: "image/jpeg",
          peso_kb: 1450.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0011/evidencia_capacitor_quemado.jpg",
          fecha_carga: d("2026-10-11T14:30:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0012",
      titulo: "Ruptura de tubería de agua potable en sanitarios masculinos",
      descripcion: "Fuga profusa de agua potable inunda el pasillo de acceso y amenaza con entrar a los laboratorios de cómputo.",
      categoria: "infraestructura",
      prioridad: "critica",
      estado: "resuelta",
      horas_invertidas: 5.5,
      fecha_creacion: d("2026-10-12T07:15:00Z"),
      fecha_resolucion: d("2026-10-12T12:45:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0412",
        nombre: "Téc. Miguel Balam Dzib",
        correo: "miguel.balam@utm.edu.mx",
        area: "infraestructura",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Planta Baja",
        aula_laboratorio: "Sanitarios Planta Baja C-00",
      },
      detalle_especifico: {
        tipo_dano: "Fontanería Mayor",
        riesgo_seguridad: "Alto",
        requiere_insumos: true,
        insumos_solicitados: ["Tubo PVC hidráulico 1 pulgada", "Pegamento CPVC", "Válvula de esfera"],
        contratista_externo: false,
      },
      tags: ["fuga-agua", "fontaneria", "inundacion"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-12T07:15:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Fuga activa en sanitarios de planta baja.",
        },
        {
          fecha: d("2026-10-12T12:45:00Z"),
          autor: "Téc. Miguel Balam Dzib",
          estado_nuevo: "resuelta",
          horas_sumadas: 5.5,
          comentario: "Cierre de llave de paso general, sustitución de tramo roto y desagüe completado.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "tuberia_rota_sanitarios.png",
          tipo_mime: "image/png",
          peso_kb: 950.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0012/tuberia_rota_sanitarios.png",
          fecha_carga: d("2026-10-12T07:30:00Z"),
        },
        {
          nombre_archivo: "reparacion_final_fontaneria.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 1100.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0012/reparacion_final_fontaneria.pdf",
          fecha_carga: d("2026-10-12T12:40:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0013",
      titulo: "Fisura estructural en muro de contención del laboratorio de Química",
      descripcion: "Se detectó grieta diagonal con desprendimiento de revoque en muro exterior tras vibraciones de obra adyacente.",
      categoria: "infraestructura",
      prioridad: "critica",
      estado: "en_proceso",
      horas_invertidas: 3.0,
      fecha_creacion: d("2026-10-13T10:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0412",
        nombre: "Téc. Miguel Balam Dzib",
        correo: "miguel.balam@utm.edu.mx",
        area: "infraestructura",
      },
      ubicacion: {
        edificio: "Edificio B - Ciencias Básicas",
        piso: "Planta Baja",
        aula_laboratorio: "Laboratorio de Química B-105",
      },
      detalle_especifico: {
        tipo_dano: "Daño Estructural",
        riesgo_seguridad: "Critico",
        requiere_insumos: true,
        insumos_solicitados: ["Testigo de yeso para grieta", "Puntal metálico telescópico"],
        contratista_externo: true,
      },
      tags: ["grieta", "estructura", "dictamen-civil"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-13T10:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Grieta perceptible a simple vista.",
        },
        {
          fecha: d("2026-10-13T12:00:00Z"),
          autor: "Téc. Miguel Balam Dzib",
          estado_nuevo: "en_proceso",
          horas_sumadas: 3.0,
          comentario: "Área acordonada. Contratista de peritaje estructural contratado.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "peritaje_grieta_b105.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 2400.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0013/peritaje_grieta_b105.pdf",
          fecha_carga: d("2026-10-13T11:45:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0014",
      titulo: "Falla de cerradura electromagnética en puerta de acceso principal",
      descripcion: "El electroimán permanece desactivado permitiendo apertura no autorizada del laboratorio de redes.",
      categoria: "infraestructura",
      prioridad: "media",
      estado: "en_espera",
      horas_invertidas: 1.0,
      fecha_creacion: d("2026-10-14T08:15:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0412",
        nombre: "Téc. Miguel Balam Dzib",
        correo: "miguel.balam@utm.edu.mx",
        area: "infraestructura",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Baja",
        aula_laboratorio: "Laboratorio K-103",
      },
      detalle_especifico: {
        tipo_dano: "Cerrajería Electrónica",
        riesgo_seguridad: "Medio",
        requiere_insumos: true,
        insumos_solicitados: ["Fuente conmutada 12V 5A", "Electroimán 600lbs"],
        contratista_externo: false,
      },
      tags: ["control-acceso", "cerradura", "seguridad-fisica"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-14T08:15:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Puerta sin cierre magnético.",
        },
        {
          fecha: d("2026-10-14T09:30:00Z"),
          autor: "Téc. Miguel Balam Dzib",
          estado_nuevo: "en_espera",
          horas_sumadas: 1.0,
          comentario: "Fuente quemada, en espera de autorización de compra en almacén.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "cerradura_quemada.jpg",
          tipo_mime: "image/jpeg",
          peso_kb: 820.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0014/cerradura_quemada.jpg",
          fecha_carga: d("2026-10-14T08:45:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0015",
      titulo: "Desprendimiento de piso cerámico en pasillo central de Biblioteca",
      descripcion: "Varias piezas de loseta se levantaron provocando riesgo de tropiezos para estudiantes.",
      categoria: "infraestructura",
      prioridad: "baja",
      estado: "abierta",
      horas_invertidas: 0,
      fecha_creacion: d("2026-10-15T11:00:00Z"),
      reportante: {
        id_usuario: "EST-2024",
        nombre: "Alejandro Pérez Noh",
        rol_institucional: "Estudiante",
        correo: "alejandro.perez@utm.edu.mx",
      },
      ubicacion: {
        edificio: "Edificio L - Idiomas y Biblioteca",
        piso: "Primer Piso",
        aula_laboratorio: "Pasillo Acceso Norte L-10",
      },
      detalle_especifico: {
        tipo_dano: "Albañilería y Pisos",
        riesgo_seguridad: "Bajo",
        requiere_insumos: true,
        insumos_solicitados: ["Adhesivo para piso cerámico", "Boquilla color beige"],
        contratista_externo: false,
      },
      tags: ["piso", "loseta", "mantenimiento-menor"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-15T11:00:00Z"),
          autor: "Alejandro Pérez Noh",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Azulejos rotos levantados en el piso.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "piso_levantado.png",
          tipo_mime: "image/png",
          peso_kb: 640.0,
          storage_key: "evidencias-utm/2026/infraestructura/INC-2026-0015/piso_levantado.png",
          fecha_carga: d("2026-10-15T11:20:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0016",
      titulo: "Falla en barandal de seguridad de escalera de emergencia",
      descripcion: "Anclaje metálico del barandal se desprendió del concreto en el segundo descanso de la escalera.",
      categoria: "infraestructura",
      prioridad: "alta",
      estado: "en_proceso",
      horas_invertidas: 2.0,
      fecha_creacion: d("2026-10-16T09:30:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0412",
        nombre: "Téc. Miguel Balam Dzib",
        correo: "miguel.balam@utm.edu.mx",
        area: "infraestructura",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Segundo Piso",
        aula_laboratorio: "Escalera Exterior Norte",
      },
      detalle_especifico: {
        tipo_dano: "Herrería y Seguridad",
        riesgo_seguridad: "Alto",
        requiere_insumos: true,
        insumos_solicitados: ["Taque expansivo de 3/8", "Electrodo para soldadura 6013"],
        contratista_externo: false,
      },
      tags: ["barandal", "proteccion-civil", "escalera"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-16T09:30:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Barandal suelto presenta riesgo de caída.",
        },
        {
          fecha: d("2026-10-16T11:00:00Z"),
          autor: "Téc. Miguel Balam Dzib",
          estado_nuevo: "en_proceso",
          horas_sumadas: 2.0,
          comentario: "Sujeción provisional y preparación para soldadura.",
        },
      ],
      evidencias_adjuntas: [],
    },
    {
      folio: "INC-2026-0017",
      titulo: "Fuga en llave mezcladora de lavabo en baño docente",
      descripcion: "El grifo no cierra completamente provocando desperdicio constante de agua potable.",
      categoria: "infraestructura",
      prioridad: "baja",
      estado: "abierta",
      horas_invertidas: 0,
      fecha_creacion: d("2026-10-17T08:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      ubicacion: {
        edificio: "Edificio A - Rectoría y Auditorios",
        piso: "Primer Piso",
        aula_laboratorio: "Sanitario Docente A-105",
      },
      detalle_especifico: {
        tipo_dano: "Fontanería Menor",
        riesgo_seguridad: "Bajo",
        requiere_insumos: true,
        insumos_solicitados: ["Empaque de hule 1/2 pulgada", "Cinta teflón"],
        contratista_externo: false,
      },
      tags: ["grifo", "goteo", "ahorro-agua"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-17T08:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Goteo continuo reportado.",
        },
      ],
      evidencias_adjuntas: [],
    },

    // ------------------------------------------------------------------------
    // SERVICIOS ACADÉMICOS (8 Incidencias: 3 resueltas, 5 con evidencias)
    // ------------------------------------------------------------------------
    {
      folio: "INC-2026-0018",
      titulo: "Error de sincronización de actas en portal de calificaciones parciales",
      descripcion: "El sistema académico impide guardar las calificaciones del segundo parcial para el grupo 5B de Desarrollo de Software.",
      categoria: "academico",
      prioridad: "alta",
      estado: "resuelta",
      horas_invertidas: 3.0,
      fecha_creacion: d("2026-10-10T14:00:00Z"),
      fecha_resolucion: d("2026-10-11T12:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0518",
        nombre: "Lic. Sofía Ortiz Lara",
        correo: "sofia.ortiz@utm.edu.mx",
        area: "academico",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Segundo Piso",
        aula_laboratorio: "Cubículo Docente C-302",
      },
      detalle_especifico: {
        plataforma: "Portal SII-UTM Calificaciones",
        codigo_curso: "BDN-2026-5B",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 28,
      },
      tags: ["sii-utm", "actas-calificaciones", "cierre-parcial"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-10T14:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Error de integridad de clave al guardar calificaciones.",
        },
        {
          fecha: d("2026-10-11T12:00:00Z"),
          autor: "Lic. Sofía Ortiz Lara",
          estado_nuevo: "resuelta",
          horas_sumadas: 3.0,
          comentario: "Se corrigió la matrícula huérfana en la base relacional de control escolar y se reabrió la captura.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "error_captura_actas.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 450.0,
          storage_key: "evidencias-utm/2026/academico/INC-2026-0018/error_captura_actas.pdf",
          fecha_carga: d("2026-10-10T14:15:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0019",
      titulo: "Fallo en entrega de tareas en Moodle UTM por cuota de almacenamiento",
      descripcion: "Los estudiantes reciben mensaje de espacio insuficiente al intentar cargar proyectos de Bases de Datos NoSQL.",
      categoria: "academico",
      prioridad: "alta",
      estado: "resuelta",
      horas_invertidas: 2.0,
      fecha_creacion: d("2026-10-12T16:00:00Z"),
      fecha_resolucion: d("2026-10-12T18:00:00Z"),
      reportante: {
        id_usuario: "EST-2024",
        nombre: "Alejandro Pérez Noh",
        rol_institucional: "Estudiante",
        correo: "alejandro.perez@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0518",
        nombre: "Lic. Sofía Ortiz Lara",
        correo: "sofia.ortiz@utm.edu.mx",
        area: "academico",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Alta",
        aula_laboratorio: "Laboratorio K-201",
      },
      detalle_especifico: {
        plataforma: "Moodle UTM Virtual",
        codigo_curso: "NOSQL-2026-7B",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 35,
      },
      tags: ["moodle", "cuota-disco", "entrega-tareas"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-12T16:00:00Z"),
          autor: "Alejandro Pérez Noh",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "No permite subir archivo PDF de 4MB.",
        },
        {
          fecha: d("2026-10-12T18:00:00Z"),
          autor: "Lic. Sofía Ortiz Lara",
          estado_nuevo: "resuelta",
          horas_sumadas: 2.0,
          comentario: "Ampliación de cuota máxima de curso de 50MB a 200MB en configuración de actividad.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "captura_error_cuota_moodle.png",
          tipo_mime: "image/png",
          peso_kb: 512.0,
          storage_key: "evidencias-utm/2026/academico/INC-2026-0019/captura_error_cuota_moodle.png",
          fecha_carga: d("2026-10-12T16:10:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0020",
      titulo: "Inconsistencia en generación de horarios de examen extraordinario",
      descripcion: "El portal asignó dos asignaturas en el mismo bloque horario para 14 estudiantes de regularización.",
      categoria: "academico",
      prioridad: "media",
      estado: "resuelta",
      horas_invertidas: 2.5,
      fecha_creacion: d("2026-10-13T11:00:00Z"),
      fecha_resolucion: d("2026-10-14T09:30:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0518",
        nombre: "Lic. Sofía Ortiz Lara",
        correo: "sofia.ortiz@utm.edu.mx",
        area: "academico",
      },
      ubicacion: {
        edificio: "Edificio A - Rectoría y Auditorios",
        piso: "Planta Baja",
        aula_laboratorio: "Ventanilla de Servicios Escolares A-04",
      },
      detalle_especifico: {
        plataforma: "Sistema Escolar Integral UTM",
        codigo_curso: "EXT-PROG-2026",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 14,
      },
      tags: ["horarios", "extraordinarios", "cruce-materias"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-13T11:00:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Conflicto de traslape horario detectado en ventanilla.",
        },
        {
          fecha: d("2026-10-14T09:30:00Z"),
          autor: "Lic. Sofía Ortiz Lara",
          estado_nuevo: "resuelta",
          horas_sumadas: 2.5,
          comentario: "Reasignación de aula y franja horaria en módulo de exámenes.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "reporte_traslape_horario.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 730.0,
          storage_key: "evidencias-utm/2026/academico/INC-2026-0020/reporte_traslape_horario.pdf",
          fecha_carga: d("2026-10-13T11:30:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0021",
      titulo: "Fallo de enrolamiento masivo de alumnos en curso de Inglés Técnico",
      descripcion: "El script de matriculación falló a mitad del proceso dejando a 45 estudiantes sin acceso al contenido.",
      categoria: "academico",
      prioridad: "alta",
      estado: "en_proceso",
      horas_invertidas: 2.0,
      fecha_creacion: d("2026-10-14T15:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0518",
        nombre: "Lic. Sofía Ortiz Lara",
        correo: "sofia.ortiz@utm.edu.mx",
        area: "academico",
      },
      ubicacion: {
        edificio: "Edificio L - Idiomas y Biblioteca",
        piso: "Primer Piso",
        aula_laboratorio: "Laboratorio de Idiomas L-102",
      },
      detalle_especifico: {
        plataforma: "Moodle UTM Idiomas",
        codigo_curso: "ING-TEC-3A",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 45,
      },
      tags: ["enrolamiento", "moodle", "ingles-tecnico"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-14T15:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Los alumnos no ven el curso en su panel principal.",
        },
        {
          fecha: d("2026-10-14T16:30:00Z"),
          autor: "Lic. Sofía Ortiz Lara",
          estado_nuevo: "en_proceso",
          horas_sumadas: 2.0,
          comentario: "Reprocesando archivo CSV de carga de cohortes.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "csv_error_enrolamiento.pdf",
          tipo_mime: "application/pdf",
          peso_kb: 380.0,
          storage_key: "evidencias-utm/2026/academico/INC-2026-0021/csv_error_enrolamiento.pdf",
          fecha_carga: d("2026-10-14T15:30:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0022",
      titulo: "Problemas de visualización en rúbricas de evaluación cualitativa",
      descripcion: "Docentes no pueden marcar criterios de evaluación por fallo de renderizado en JavaScript del portal escolar.",
      categoria: "academico",
      prioridad: "media",
      estado: "en_espera",
      horas_invertidas: 1.0,
      fecha_creacion: d("2026-10-15T09:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0518",
        nombre: "Lic. Sofía Ortiz Lara",
        correo: "sofia.ortiz@utm.edu.mx",
        area: "academico",
      },
      ubicacion: {
        edificio: "Edificio C - División de Tecnologías",
        piso: "Segundo Piso",
        aula_laboratorio: "Cubículo Docente C-303",
      },
      detalle_especifico: {
        plataforma: "Portal Docente UTM",
        codigo_curso: "PROY-INT-7B",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 30,
      },
      tags: ["rubricas", "evaluacion", "interfaz-web"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-15T09:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Botones de selección de niveles deshabilitados en el navegador.",
        },
        {
          fecha: d("2026-10-15T10:30:00Z"),
          autor: "Lic. Sofía Ortiz Lara",
          estado_nuevo: "en_espera",
          horas_sumadas: 1.0,
          comentario: "En espera de despliegue de hotfix por equipo de desarrollo.",
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: "captura_consola_js.png",
          tipo_mime: "image/png",
          peso_kb: 490.0,
          storage_key: "evidencias-utm/2026/academico/INC-2026-0022/captura_consola_js.png",
          fecha_carga: d("2026-10-15T09:40:00Z"),
        },
      ],
    },
    {
      folio: "INC-2026-0023",
      titulo: "Bloqueo de constancias de estudio digitales con firma electrónica",
      descripcion: "El módulo de emisión arroja error de certificado digital vencido al validar el sello criptográfico.",
      categoria: "academico",
      prioridad: "alta",
      estado: "abierta",
      horas_invertidas: 0,
      fecha_creacion: d("2026-10-16T13:00:00Z"),
      reportante: {
        id_usuario: "ADM-0422",
        nombre: "Lic. Laura Canto Várguez",
        rol_institucional: "Administrativo",
        correo: "laura.canto@utm.edu.mx",
      },
      ubicacion: {
        edificio: "Edificio A - Rectoría y Auditorios",
        piso: "Planta Baja",
        aula_laboratorio: "Archivo y Certificaciones A-08",
      },
      detalle_especifico: {
        plataforma: "Sistema de Firma Digital UTM",
        codigo_curso: "CONST-OFIC-2026",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 80,
      },
      tags: ["firma-digital", "constancias", "certificado-ssl"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-16T13:00:00Z"),
          autor: "Lic. Laura Canto Várguez",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Certificado caducado detiene trámite de becas.",
        },
      ],
      evidencias_adjuntas: [],
    },
    {
      folio: "INC-2026-0024",
      titulo: "Demora en carga de banco de preguntas en exámenes diagnósticos",
      descripcion: "Timeout en la base de datos al renderizar preguntas aleatorias con imágenes vectoriales pesadas.",
      categoria: "academico",
      prioridad: "media",
      estado: "abierta",
      horas_invertidas: 0.5,
      fecha_creacion: d("2026-10-17T09:00:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      ubicacion: {
        edificio: "Edificio B - Ciencias Básicas",
        piso: "Primer Piso",
        aula_laboratorio: "Aula Audiovisual B-102",
      },
      detalle_especifico: {
        plataforma: "Plataforma de Evaluación Diagnóstica",
        codigo_curso: "DIAG-CB-2026",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 110,
      },
      tags: ["banco-preguntas", "timeout", "evaluacion-diagnostica"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-17T09:00:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0.5,
          comentario: "Examen no carga a tiempo para el inicio de la prueba.",
        },
      ],
      evidencias_adjuntas: [],
    },
    {
      folio: "INC-2026-0025",
      titulo: "Fallo en pase de lista digital desde la aplicación móvil universitaria",
      descripcion: "La API institucional rechaza las asistencias emitidas desde dispositivos Android versión 12 o inferior.",
      categoria: "academico",
      prioridad: "baja",
      estado: "en_proceso",
      horas_invertidas: 1.5,
      fecha_creacion: d("2026-10-17T11:30:00Z"),
      reportante: {
        id_usuario: "DOC-1042",
        nombre: "Mtro. Carlos Méndez Cetina",
        rol_institucional: "Docente",
        correo: "carlos.docente@utm.edu.mx",
      },
      tecnico_asignado: {
        id_usuario: "TEC-0518",
        nombre: "Lic. Sofía Ortiz Lara",
        correo: "sofia.ortiz@utm.edu.mx",
        area: "academico",
      },
      ubicacion: {
        edificio: "Edificio K - Tecnologías de la Información",
        piso: "Planta Baja",
        aula_laboratorio: "Aula K-105",
      },
      detalle_especifico: {
        plataforma: "App Móvil UTM Alumnos",
        codigo_curso: "MOV-7A-2026",
        periodo_escolar: "Septiembre - Diciembre 2026",
        estudiantes_impactados: 26,
      },
      tags: ["app-movil", "pase-lista", "api-rest"],
      historial_seguimiento: [
        {
          fecha: d("2026-10-17T11:30:00Z"),
          autor: "Mtro. Carlos Méndez Cetina",
          estado_nuevo: "abierta",
          horas_sumadas: 0,
          comentario: "Error HTTP 422 al sincronizar la lista del grupo.",
        },
        {
          fecha: d("2026-10-17T13:00:00Z"),
          autor: "Lic. Sofía Ortiz Lara",
          estado_nuevo: "en_proceso",
          horas_sumadas: 1.5,
          comentario: "Identificada incompatibilidad con formato de fecha en el body.",
        },
      ],
      evidencias_adjuntas: [],
    },
  ];
}

async function seedIncidencias(db: Db): Promise<{ inserted: number; skipped: number; total: number }> {
  console.log("[MongoDB] Procesando sembrado de incidencias sintéticas...");
  const colIncidencias = db.collection<IncidenciaSeedDoc>("incidencias_campus");
  const dataset = buildSyntheticIncidents();

  let inserted = 0;
  let skipped = 0;

  for (const inc of dataset) {
    const existing = await colIncidencias.findOne({ folio: inc.folio });
    if (!existing) {
      await colIncidencias.insertOne(inc);
      inserted++;
    } else {
      skipped++;
    }
  }

  const total = await colIncidencias.countDocuments();
  return { inserted, skipped, total };
}

// ============================================================================
// 6. INICIALIZAR CONTADOR DE UPSTASH REDIS DE FORMA SEGURA Y ATÓMICA
// ============================================================================

async function syncRedisCounter(
  db: Db,
  year: number = ANIO_ACTUAL
): Promise<{ previous: number; final: number; counterKey: string }> {
  console.log(`[Redis] Sincronizando contador atómico del año ${year}...`);

  // 1. Obtener la secuencia numérica máxima existente en MongoDB Atlas para el año en proceso (INC-AAAA-NNNN)
  const regexFolio = new RegExp(`^INC-${year}-(\\d{4})$`);
  const docs = await db
    .collection("incidencias_campus")
    .find({ folio: { $regex: regexFolio } })
    .project({ folio: 1 })
    .toArray();

  let maxMongoSeq = 0;
  for (const doc of docs) {
    if (typeof doc.folio === "string") {
      const match = doc.folio.match(regexFolio);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (seq > maxMongoSeq) {
          maxMongoSeq = seq;
        }
      }
    }
  }

  // 2. El valor objetivo es la secuencia máxima existente en MongoDB Atlas (sin literales fijos)
  const targetVal = maxMongoSeq;

  // 3. REGLA CRÍTICA DE INTEGRIDAD: delegada a ensureCounterAtLeast (INCRBY, nunca SET ni decremento)
  const result = await ensureCounterAtLeast(year, targetVal);

  if (result.final === result.previous) {
    console.log(
      `[Redis] Valor actual (${result.previous}) es suficiente e íntegro (>= ${targetVal}). No se modifica.`
    );
  } else {
    console.log(
      `[Redis] Valor actual (${result.previous}) menor que ${targetVal}. Incrementado a ${result.final}.`
    );
  }

  return result;
}

// ============================================================================
// 7. ORQUESTADOR PRINCIPAL
// ============================================================================

async function main() {
  console.log("========================================================================");
  console.log("  UTM DESK NOSQL CLOUD — INICIALIZACIÓN Y AUDITORÍA DE BASE DE DATOS");
  console.log("========================================================================");

  // 1. Verificación de variables requeridas
  const missingVars: string[] = [];
  if (!MONGODB_URI) missingVars.push("MONGODB_URI");
  if (!REDIS_URL) missingVars.push("UPSTASH_REDIS_REST_URL");
  if (!REDIS_TOKEN) missingVars.push("UPSTASH_REDIS_REST_TOKEN");
  if (!SEED_DEFAULT_PASSWORD) missingVars.push("SEED_DEFAULT_PASSWORD");

  if (missingVars.length > 0) {
    console.error("\n[ERROR FATAL] Faltan variables de entorno requeridas en .env.local:");
    for (const v of missingVars) {
      console.error(`  - ${v}`);
    }
    console.error("\nConfigura estas variables en tu archivo .env.local antes de ejecutar el seed.");
    process.exit(1);
  }

  console.log(`[Config] Base de datos seleccionada: ${MONGODB_DB}`);
  console.log("[Config] Conexión protegida: no se imprimen credenciales ni tokens.");

  if (process.argv.includes("--dry-run") || process.argv.includes("--check-only")) {
    console.log(
      "\n[Dry-Run] Verificación inofensiva: main() fue invocado con éxito y los guardias de ejecución funcionan."
    );
    return;
  }

  let mongoClient: MongoClient | null = null;

  try {
    // 2. Conexión a MongoDB Atlas
    console.log("\n1. Conectando a MongoDB Atlas...");
    mongoClient = new MongoClient(MONGODB_URI!, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DB);
    await db.command({ ping: 1 });
    console.log("   ✓ Conexión a MongoDB Atlas establecida con éxito.");

    // 3. Conexión a Upstash Redis
    console.log("\n2. Conectando a Upstash Redis...");
    const redisClient = new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    });
    await redisClient.ping();
    console.log("   ✓ Conexión a Upstash Redis validada con éxito (PING -> PONG).");

    // 4. Esquemas $jsonSchema
    console.log("\n3. Configurando colecciones y validadores formales $jsonSchema...");
    await ensureCollectionWithValidator(db, "usuarios", usuariosSchema);
    await ensureCollectionWithValidator(db, "incidencias_campus", incidenciasCampusSchema);
    console.log("   ✓ Validadores aplicados en nivel 'strict' y acción 'error'.");

    // 5. Índices requeridos
    console.log("\n4. Configurando índices obligatorios...");
    await setupIndexes(db);
    console.log("   ✓ Índices creados: Compuesto, TTL (60 días), Full-Text ponderado y únicos.");

    // 6. Sembrar usuarios
    console.log("\n5. Sembrando usuarios RBAC institucionales...");
    const userStats = await seedUsuarios(db);
    console.log(`   ✓ Usuarios: ${userStats.inserted} insertados, ${userStats.skipped} preservados.`);

    // 7. Sembrar incidencias
    console.log("\n6. Sembrando incidencias sintéticas...");
    const incStats = await seedIncidencias(db);
    console.log(`   ✓ Incidencias: ${incStats.inserted} insertadas, ${incStats.skipped} preservadas.`);

    // 8. Sincronizar contador de Redis
    console.log("\n7. Verificando secuencia atómica en Upstash Redis...");
    const redisStats = await syncRedisCounter(db, ANIO_ACTUAL);
    console.log(`   ✓ Clave: ${redisStats.counterKey} = ${redisStats.final} (Previo: ${redisStats.previous})`);

    // ========================================================================
    // 8. AUDITORÍA FINAL DE REQUERIMIENTOS
    // ========================================================================
    console.log("\n========================================================================");
    console.log("  RESUMEN DE AUDITORÍA Y VERIFICACIONES (ACADÉMICAMENTE CONFORME)");
    console.log("========================================================================");

    const totalUsuarios = await db.collection("usuarios").countDocuments();
    const totalIncidencias = await db.collection("incidencias_campus").countDocuments();
    const resueltas = await db.collection("incidencias_campus").countDocuments({ estado: "resuelta" });
    const conEvidencias = await db.collection("incidencias_campus").countDocuments({
      "evidencias_adjuntas.0": { $exists: true },
    });
    const edificios = await db.collection("incidencias_campus").distinct("ubicacion.edificio");
    const porCategoria = await db.collection("incidencias_campus").aggregate([
      { $group: { _id: "$categoria", total: { $sum: 1 } } },
    ]).toArray();

    console.log(`- Colección 'usuarios':           ${totalUsuarios} usuarios activos`);
    console.log(`- Colección 'incidencias_campus': ${totalIncidencias} incidencias totales`);
    console.log(`- Incidencias Resueltas:          ${resueltas} (Requisito: >= 8) -> ${resueltas >= 8 ? "CUMPLE ✓" : "FALLA ✗"}`);
    console.log(`- Con Evidencias Adjuntas:        ${conEvidencias} (Requisito: >= 15) -> ${conEvidencias >= 15 ? "CUMPLE ✓" : "FALLA ✗"}`);
    console.log(`- Edificios Distintos:            ${edificios.length} (Requisito: >= 4) -> ${edificios.length >= 4 ? "CUMPLE ✓" : "FALLA ✗"}`);
    console.log("  Edificios detectados:");
    edificios.forEach((ed) => console.log(`    * ${ed}`));
    console.log("- Distribución por categoría:");
    porCategoria.forEach((cat) => console.log(`    * ${cat._id}: ${cat.total}`));
    console.log(`- Contador atómico en Redis:      ${redisStats.counterKey} = ${redisStats.final}`);
    console.log("========================================================================");
    console.log("  ESTRUCTURA DE DATOS PREPARADA E IDEMPOTENTE CON ÉXITO.");
    console.log("========================================================================\n");
  } catch (error: unknown) {
    console.error("\n[ERROR EN LA EJECUCIÓN DEL SCRIPT]");
    const message = error instanceof Error ? error.message : String(error);
    // Sanitizar cadenas de conexión para evitar fugas en logs
    const sanitized = message.replace(/mongodb(\+srv)?:\/\/[^\s@]+@/gi, "mongodb$1://[REDACTED]@");
    console.error(sanitized);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

// Ejecutar script solo cuando es invocado directamente (no cuando es importado por pruebas)
const isDirectRun =
  Boolean(process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/setup-db-and-seed.ts")) ||
  (typeof require !== "undefined" && require.main === module);
if (isDirectRun) {
  main();
}

