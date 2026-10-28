import { z } from "zod";

export const ubicacionSchema = z.object({
  edificio: z.string().trim().min(1, "Indica el edificio."),
  piso: z.string().trim().min(1, "Indica el piso."),
  aula_laboratorio: z.string().trim().min(1, "Indica el aula o laboratorio."),
});

const ipv4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export const detalleComputoRedesSchema = z.object({
  direccion_ip: z
    .string()
    .trim()
    .regex(ipv4, "Usa una dirección IPv4 válida."),
  vlan: z.number().int().min(1).max(4094),
  puerto_uplink: z.string().trim().min(1, "Indica el puerto uplink."),
  equipos_afectados: z.number().int().min(0),
}).strict();

export const detalleInfraestructuraSchema = z.object({
    tipo_dano: z.string().trim().min(3, "Describe el tipo de daño."),
    riesgo_seguridad: z.string().trim().min(1),
    requiere_insumos: z.boolean(),
    contratista_externo: z.boolean(),
  }).strict();

export const detalleAcademicoSchema = z.object({
  plataforma: z.string().trim().min(2, "Indica la plataforma."),
  codigo_curso: z.string().trim().min(2, "Indica el código de curso."),
  periodo_escolar: z.string().trim().min(2, "Indica el periodo escolar."),
  estudiantes_impactados: z.coerce
    .number()
    .int("Debe ser un número entero.")
    .min(0, "No puede ser negativo."),
}).strict();

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
  prioridad: z.enum(["baja", "media", "alta", "critica"], {
    error: "Selecciona una prioridad.",
  }),
  ubicacion: ubicacionSchema,
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

export const historialSeguimientoSchema = z.object({
  fecha: z.string().datetime({ offset: true }),
  autor: z.string().trim().min(1),
  estado_nuevo: z.enum(["abierta", "en proceso", "en espera", "resuelta", "cerrada"]),
  horas_sumadas: z.number().min(0),
  comentario: z.string().trim().min(1),
}).strict();

export const evidenciaAdjuntaSchema = z.object({
  nombre_archivo: z.string().trim().min(1),
  tipo_mime: z.string().trim().min(1),
  peso_kb: z.number().min(0),
  url_storage: z.string().trim().min(1),
  fecha_carga: z.string().datetime({ offset: true }),
}).strict();

const documentoBase = {
  _id: z.string().min(1),
  folio: z.string().regex(/^INC-[0-9]{4}-[0-9]{4}$/),
  ...camposUniversales,
  estado: z.enum(["abierta", "en proceso", "en espera", "resuelta", "cerrada"]),
  horas_invertidas: z.number().min(0),
  fecha_creacion: z.string().datetime({ offset: true }),
  fecha_resolucion: z.string().datetime({ offset: true }).optional(),
  reportante: z.object({
    id_usuario: z.string().min(1),
    nombre: z.string().min(1),
    rol: z.enum(["Docente", "Estudiante", "Administrativo"]),
    correo: z.string().email(),
  }).strict(),
  tags: z.array(z.string().trim().min(1)),
  historial_seguimiento: z.array(historialSeguimientoSchema).min(1),
  evidencias_adjuntas: z.array(evidenciaAdjuntaSchema),
};

export const incidenciaDocumentoSchema = z.discriminatedUnion("categoria", [
  z.object({ ...documentoBase, categoria: z.literal("computo_redes"), detalle_especifico: detalleComputoRedesSchema }).strict(),
  z.object({ ...documentoBase, categoria: z.literal("infraestructura"), detalle_especifico: detalleInfraestructuraSchema }).strict(),
  z.object({ ...documentoBase, categoria: z.literal("academico"), detalle_especifico: detalleAcademicoSchema }).strict(),
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
