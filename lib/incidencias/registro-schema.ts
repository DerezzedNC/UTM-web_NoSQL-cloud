import { z } from "zod";
import { detalleAcademicoSchema, detalleComputoRedesSchema, detalleInfraestructuraSchema, ubicacionSchema } from "./schema";

const base = {
  titulo: z.string().trim().min(10).max(150),
  descripcion: z.string().trim().min(15),
  tags: z.array(z.string().trim().min(1)),
  prioridad: z.enum(["baja", "media", "alta", "critica"]),
  ubicacion: ubicacionSchema,
  reportante: z.object({
    id_usuario: z.string().min(1),
    nombre: z.string().min(1),
    rol: z.enum(["Docente", "Estudiante", "Administrativo"]),
    correo: z.string().email(),
  }),
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
