// Tabla 4 del documento (matriz RBAC)
const PUEDE = {
  crear: ['admin', 'reportante'],            // CU-01
  evidencia: ['admin', 'tecnico', 'reportante'], // CU-02
  estado: ['admin', 'tecnico'],              // CU-03
  tags: ['admin', 'coordinador', 'tecnico'], // CU-04
  analitica: ['admin', 'directiva', 'coordinador'], // CU-06
};
export const can = (u, accion) => !!u && PUEDE[accion].includes(u.rol);
