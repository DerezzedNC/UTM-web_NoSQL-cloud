import { z } from "zod";

export const ubicacionSchema = z.object({
  edificio: z.string().trim().min(1, "Indica el edificio."),
  piso: z.string().trim().min(1, "Indica el piso."),
  aula_laboratorio: z.string().trim().min(1, "Indica el aula o laboratorio."),
}).strict();

const ipv4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export const detalleComputoRedesSchema = z.object({
  direccion_ip: z
    .string()
    .trim()
    .regex(ipv4, "Usa una dirección IPv4 válida."),
  vlan: z.coerce.number().int().min(1, "La VLAN mínima es 1.").max(4094, "La VLAN máxima es 4094."),
  puerto_uplink: z.string().trim().min(1, "Indica el puerto uplink."),
  equipos_afectados: z.coerce.number().int().min(1, "Debe haber al menos 1 equipo afectado."),
}).strict();

export const RIESGOS_SEGURIDAD = ["Bajo", "Medio", "Alto", "Critico"] as const;
export const riesgoSeguridadEnum = z.preprocess(
  (val) => (val === "Crítico" ? "Critico" : val),
  z.enum(RIESGOS_SEGURIDAD, {
    error: "El riesgo de seguridad debe ser Bajo, Medio, Alto o Critico.",
  })
);

export const detalleInfraestructuraSchema = z.object({
  tipo_dano: z.string().trim().min(3, "Describe el tipo de daño."),
  riesgo_seguridad: riesgoSeguridadEnum,
  requiere_insumos: z.boolean(),
  insumos_solicitados: z.array(z.string().trim()).default([]),
  contratista_externo: z.boolean(),
}).strict();

export const detalleAcademicoSchema = z.object({
  plataforma: z.string().trim().min(2, "Indica la plataforma."),
  codigo_curso: z.string().trim().min(2, "Indica el código de curso."),
  periodo_escolar: z.string().trim().min(2, "Indica el periodo escolar."),
  estudiantes_impactados: z.coerce
    .number()
    .int("Debe ser un número entero.")
    .min(1, "Debe haber al menos 1 estudiante impactado."),
}).strict();

export const ROLES_REPORTANTE = ["Docente", "Estudiante", "Administrativo"] as const;
export const rolInstitucionalEnum = z.enum(ROLES_REPORTANTE);

export const reportanteSchema = z.preprocess(
  (val: unknown) => {
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const canonical = obj.rol_institucional ?? obj.rol;
      return {
        ...obj,
        rol_institucional: canonical,
        rol: canonical,
      };
    }
    return val;
  },
  z.object({
    id_usuario: z.string().trim().min(1, "Indica el ID de usuario."),
    nombre: z.string().trim().min(1, "Indica el nombre."),
    rol_institucional: rolInstitucionalEnum,
    rol: rolInstitucionalEnum.optional(),
    correo: z.string().trim().email("Indica un correo válido."),
  }).strict()
);

export const evidenciaBorradorSchema = z.object({
  nombre_archivo: z.string().trim().min(1),
  tipo_mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  peso_kb: z.number().min(0).max(5120),
  contenido_base64: z.string().optional(),
});

export const camposUniversalesSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(10, "El título debe tener al menos 10 caracteres.")
    .max(150, "El título no puede superar 150 caracteres."),
  descripcion: z
    .string()
    .trim()
    .min(15, "La descripción debe tener al menos 15 caracteres."),
  prioridad: z.preprocess(
    (val) => (val === undefined || val === null || val === "" ? "media" : val),
    z.enum(["baja", "media", "alta", "critica"], {
      error: "Selecciona una prioridad.",
    })
  ).default("media"),
  ubicacion: ubicacionSchema,
  reportante: reportanteSchema,
  tags: z.preprocess(
    (val) => (val === undefined || val === null ? [] : val),
    z.array(z.string().trim().min(1)).default([])
  ),
  evidencias: z.array(evidenciaBorradorSchema).optional().default([]),
});

const camposUniversales = camposUniversalesSchema.shape;

export const incidenciaCampusSchema = z.discriminatedUnion("categoria", [
  z.object({
    ...camposUniversales,
    categoria: z.literal("computo_redes"),
    detalle_especifico: detalleComputoRedesSchema,
  }).strict(),
  z.object({
    ...camposUniversales,
    categoria: z.literal("infraestructura"),
    detalle_especifico: detalleInfraestructuraSchema,
  }).strict(),
  z.object({
    ...camposUniversales,
    categoria: z.literal("academico"),
    detalle_especifico: detalleAcademicoSchema,
  }).strict(),
]);

export const ESTADOS_CANONICOS = ["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"] as const;

export const estadoIncidenciaEnum = z.preprocess(
  (val) => {
    if (val === "en proceso") return "en_proceso";
    if (val === "en espera") return "en_espera";
    return val;
  },
  z.enum(ESTADOS_CANONICOS)
);

export const historialSeguimientoSchema = z.object({
  fecha: z.union([z.string().datetime({ offset: true }), z.date()]),
  autor: z.string().trim().min(1),
  estado_nuevo: estadoIncidenciaEnum,
  horas_sumadas: z.number().min(0),
  comentario: z.string().trim().min(1),
}).strict();

export const evidenciaAdjuntaSchema = z.object({
  nombre_archivo: z.string().trim().min(1),
  tipo_mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  peso_kb: z.number().min(0).max(5120),
  storage_key: z.string().trim().min(1),
  url_storage: z.string().trim().min(1).optional(),
  fecha_carga: z.union([z.string().datetime({ offset: true }), z.date()]),
}).strict();

const documentoBase = {
  _id: z.any().optional(),
  folio: z.string().regex(/^INC-[0-9]{4}-[0-9]{4}$/),
  ...camposUniversales,
  estado: estadoIncidenciaEnum,
  horas_invertidas: z.number().min(0),
  fecha_creacion: z.union([z.string().datetime({ offset: true }), z.date()]),
  fecha_resolucion: z.union([z.string().datetime({ offset: true }), z.date()]).optional(),
  reportante: reportanteSchema,
  tags: z.preprocess(
    (val) => (val === undefined || val === null ? [] : val),
    z.array(z.string().trim().min(1)).default([])
  ),
  historial_seguimiento: z.array(historialSeguimientoSchema).min(1),
  evidencias_adjuntas: z.array(evidenciaAdjuntaSchema).default([]),
};

export const incidenciaDocumentoSchema = z.discriminatedUnion("categoria", [
  z.object({ ...documentoBase, categoria: z.literal("computo_redes"), detalle_especifico: detalleComputoRedesSchema }),
  z.object({ ...documentoBase, categoria: z.literal("infraestructura"), detalle_especifico: detalleInfraestructuraSchema }),
  z.object({ ...documentoBase, categoria: z.literal("academico"), detalle_especifico: detalleAcademicoSchema }),
]);

export type IncidenciaCampusPayload = z.infer<typeof incidenciaCampusSchema>;

export function erroresPorCampo(error: z.ZodError) {
  const mapa: Record<string, string> = {};

  for (const issue of error.issues) {
    const ruta = issue.path.join(".");
    if (ruta && !mapa[ruta]) {
      mapa[ruta] = issue.message;
    }
  }

  return mapa;
}
