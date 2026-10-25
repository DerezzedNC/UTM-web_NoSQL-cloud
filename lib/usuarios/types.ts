export type RolRBAC =
  | "admin"
  | "directiva"
  | "coordinador"
  | "tecnico"
  | "reportante";

export type AreaAsignada =
  | "computo_redes"
  | "infraestructura"
  | "academico";

export type RolInstitucional = "Docente" | "Estudiante" | "Administrativo";

export type Usuario = {
  _id: string;
  id_usuario: string;
  nombre: string;
  correo: string;
  departamento: string;
  rol: RolRBAC;
  activo: boolean;
  area_asignada?: AreaAsignada;
  rol_institucional?: RolInstitucional;
};

export const USUARIOS_INICIALES: Usuario[] = [
  {
    _id: "usr-0205",
    id_usuario: "TEC-0205",
    nombre: "Carlos Morales S.",
    correo: "carlos.morales@utm.edu.mx",
    departamento: "Infraestructura y TI",
    rol: "tecnico",
    activo: true,
    area_asignada: "computo_redes",
  },
  {
    _id: "usr-1842",
    id_usuario: "DOC-1842",
    nombre: "Ing. Roberto Mendieta",
    correo: "roberto.mendieta@utm.edu.mx",
    departamento: "Ingeniería de Sistemas",
    rol: "reportante",
    activo: true,
    rol_institucional: "Docente",
  },
  {
    _id: "usr-0311",
    id_usuario: "ADM-0311",
    nombre: "Carlos Méndez",
    correo: "carlos.mendez@utm.edu.mx",
    departamento: "Dirección de TI",
    rol: "admin",
    activo: true,
  },
  {
    _id: "usr-0216",
    id_usuario: "TEC-0216",
    nombre: "Joaquín Valenzuela",
    correo: "joaquin.valenzuela@utm.edu.mx",
    departamento: "Infraestructura y TI",
    rol: "tecnico",
    activo: true,
    area_asignada: "infraestructura",
  },
  {
    _id: "usr-0014",
    id_usuario: "DIR-0014",
    nombre: "Dra. Carmen Solís",
    correo: "carmen.solis@utm.edu.mx",
    departamento: "Rectorado",
    rol: "directiva",
    activo: true,
  },
  {
    _id: "usr-4891",
    id_usuario: "REP-4891",
    nombre: "Mario Valdés",
    correo: "mario.valdes@utm.edu.mx",
    departamento: "Campus Norte",
    rol: "reportante",
    activo: true,
    rol_institucional: "Administrativo",
  },
];
