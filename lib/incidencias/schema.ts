import { z } from "zod";

const ubicacionSchema = z.object({
  edificio: z.string().trim().min(1, "Indica el edificio."),
  piso: z.string().trim().min(1, "Indica el piso."),
  aula_laboratorio: z.string().trim().min(1, "Indica el aula o laboratorio."),
});

const ipv4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

const detalleComputoRedesSchema = z.object({
  direccion_ip: z
    .string()
    .trim()
    .regex(ipv4, "Usa una dirección IPv4 válida."),
  vlan: z
    .string()
    .trim()
    .regex(/^\d+$/, "La VLAN debe ser un número.")
    .refine((value) => {
      const vlan = Number(value);
      return vlan >= 1 && vlan <= 4094;
    }, "La VLAN debe estar entre 1 y 4094."),
  puerto_uplink: z.string().trim().min(1, "Indica el puerto uplink."),
  equipos_afectados: z
    .array(z.string().trim().min(1))
    .min(1, "Agrega al menos un equipo afectado."),
});

const detalleInfraestructuraSchema = z
  .object({
    tipo_dano: z.string().trim().min(3, "Describe el tipo de daño."),
    riesgo_seguridad: z.enum(["Bajo", "Medio", "Alto", "Crítico"]),
    requiere_insumos: z.boolean(),
    insumos_solicitados: z.array(z.string().trim().min(1)),
    contratista_externo: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.requiere_insumos && value.insumos_solicitados.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["insumos_solicitados"],
        message: "Lista los insumos solicitados.",
      });
    }
  });

const detalleAcademicoSchema = z.object({
  plataforma: z.string().trim().min(2, "Indica la plataforma."),
  codigo_curso: z.string().trim().min(2, "Indica el código de curso."),
  periodo_escolar: z.string().trim().min(2, "Indica el periodo escolar."),
  estudiantes_impactados: z.coerce
    .number()
    .int("Debe ser un número entero.")
    .min(0, "No puede ser negativo."),
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
  }),
  z.object({
    ...camposUniversales,
    categoria: z.literal("infraestructura"),
    detalle_especifico: detalleInfraestructuraSchema,
  }),
  z.object({
    ...camposUniversales,
    categoria: z.literal("academico"),
    detalle_especifico: detalleAcademicoSchema,
  }),
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
