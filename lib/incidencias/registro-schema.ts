import { z } from "zod";

const ubicacion = z.object({
  edificio: z.string().trim().min(1),
  piso: z.string().trim().min(1),
  aula_laboratorio: z.string().trim().min(1),
});

const base = {
  titulo: z.string().trim().min(10).max(150),
  descripcion: z.string().trim().min(15),
  tags: z.array(z.string().trim().min(1)),
  prioridad: z.enum(["baja", "media", "alta", "critica"]),
  ubicacion,
  reportante: z.object({
    id_usuario: z.string().min(1),
    nombre: z.string().min(1),
    tipo: z.enum(["Docente", "Estudiante", "Administrativo"]),
    correo: z.string().email(),
  }),
};

export const registroIncidenciaSchema = z.discriminatedUnion("categoria", [
  z.object({
    ...base,
    categoria: z.literal("computo_redes"),
    detalle_especifico: z.object({
      direccion_ip: z.string().trim().min(1),
      vlan: z.number().int().min(1).max(4094),
      puerto_uplink: z.string().trim().min(1),
      equipos_afectados: z.number().int().min(1),
    }),
  }),
  z.object({
    ...base,
    categoria: z.literal("infraestructura"),
    detalle_especifico: z.object({
      tipo_dano: z.string().trim().min(1),
      riesgo_seguridad: z.enum(["Bajo", "Medio", "Alto", "Critico"]),
      requiere_insumos: z.boolean(),
      insumos_solicitados: z.array(z.string().trim().min(1)),
      contratista_externo: z.boolean(),
    }),
  }),
  z.object({
    ...base,
    categoria: z.literal("academico"),
    detalle_especifico: z.object({
      plataforma: z.string().trim().min(1),
      codigo_curso: z.string().trim().min(1),
      periodo_escolar: z.string().trim().min(1),
      estudiantes_impactados: z.number().int().min(1),
    }),
  }),
]);

export type RegistroIncidenciaPayload = z.infer<typeof registroIncidenciaSchema>;
