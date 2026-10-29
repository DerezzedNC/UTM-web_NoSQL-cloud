import { z } from "zod";
import { detalleAcademicoSchema, detalleComputoRedesSchema, detalleInfraestructuraSchema, ubicacionSchema } from "./schema";

const evidenciaBorradorSchema = z.object({
  nombre_archivo: z.string().trim().min(1),
  tipo_mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  peso_kb: z.number().min(0).max(5120),
});

const base = {
  titulo: z.string().trim().min(10, "El título debe tener al menos 10 caracteres.").max(150, "El título no puede superar 150 caracteres."),
  descripcion: z.string().trim().min(15, "La descripción debe tener al menos 15 caracteres."),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  prioridad: z.enum(["baja", "media", "alta", "critica"]).optional().default("media"),
  ubicacion: ubicacionSchema,
  reportante: z.object({
    id_usuario: z.string().min(1, "Falta el ID de usuario."),
    nombre: z.string().min(1, "Falta el nombre del reportante."),
    rol: z.enum(["Docente", "Estudiante", "Administrativo"]),
    correo: z.string().email("Correo institucional inválido."),
  }),
  evidencias: z.array(evidenciaBorradorSchema).optional().default([]),
};

export const registroIncidenciaSchema = z.discriminatedUnion("categoria", [
  z.object({
    ...base,
    categoria: z.literal("computo_redes"),
    detalle_especifico: detalleComputoRedesSchema,
  }),
  z.object({
    ...base,
    categoria: z.literal("infraestructura"),
    detalle_especifico: detalleInfraestructuraSchema,
  }),
  z.object({
    ...base,
    categoria: z.literal("academico"),
    detalle_especifico: detalleAcademicoSchema,
  }),
]);

export type RegistroIncidenciaPayload = z.infer<typeof registroIncidenciaSchema>;
