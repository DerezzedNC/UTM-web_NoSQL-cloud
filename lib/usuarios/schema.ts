import { z } from "zod";

const base = {
  id_usuario: z.string().trim().min(3),
  nombre: z.string().trim().min(5),
  correo: z.string().trim().email().regex(/@utm\.edu\.mx$/, "Usa un correo @utm.edu.mx."),
  departamento: z.string().trim().min(1),
  activo: z.boolean(),
};

export const usuarioSchema = z.discriminatedUnion("rol", [
  z.object({ ...base, rol: z.enum(["admin", "directiva", "coordinador"]) }),
  z.object({
    ...base,
    rol: z.literal("tecnico"),
    area_asignada: z.enum(["computo_redes", "infraestructura", "academico"]),
  }),
  z.object({
    ...base,
    rol: z.literal("reportante"),
    rol_institucional: z.enum(["Docente", "Estudiante", "Administrativo"]),
  }),
]);

export type UsuarioPayload = z.infer<typeof usuarioSchema>;
