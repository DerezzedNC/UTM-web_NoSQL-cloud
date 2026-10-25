export const ESTADOS = ['abierta', 'en_proceso', 'en_espera', 'resuelta', 'cerrada'];
export const ESTADO = { abierta: 'bg-sky-100 text-sky-800', en_proceso: 'bg-amber-100 text-amber-800', en_espera: 'bg-slate-200 text-slate-700', resuelta: 'bg-emerald-100 text-emerald-800', cerrada: 'bg-slate-800 text-white' };
export const PRIO = { baja: 'bg-slate-300', media: 'bg-sky-500', alta: 'bg-amber-500', critica: 'bg-red-600' };
export const CAT = { computo_redes: 'Cómputo y Redes', infraestructura: 'Infraestructura', academico: 'Académico' };
export const lbl = s => s.replace('_', ' ');
export const fecha = d => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
export const inp = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm';
export const btn = 'rounded bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-dark disabled:opacity-50';
export const Badge = ({ v }) => <span className={`rounded px-2 py-0.5 text-xs font-medium ${ESTADO[v]}`}>{lbl(v)}</span>;
export const Err = ({ m }) => m ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{m}</p> : null;
// Campos del subdocumento polimórfico detalle_especifico (Listado 6): [clave, etiqueta, tipo, ...opciones]
export const DET = {
  computo_redes: [['direccion_ip', 'Dirección IP', 'text'], ['vlan', 'VLAN', 'int', 1, 4094], ['puerto_uplink', 'Puerto uplink', 'text'], ['equipos_afectados', 'Equipos afectados', 'int', 1]],
  infraestructura: [['tipo_dano', 'Tipo de daño', 'text'], ['riesgo_seguridad', 'Riesgo de seguridad', 'sel', ['Bajo', 'Medio', 'Alto', 'Critico']], ['requiere_insumos', 'Requiere insumos', 'bool'], ['insumos_solicitados', 'Insumos (separados por coma)', 'list'], ['contratista_externo', 'Contratista externo', 'bool']],
  academico: [['plataforma', 'Plataforma', 'text'], ['codigo_curso', 'Código de curso', 'text'], ['periodo_escolar', 'Periodo escolar', 'text'], ['estudiantes_impactados', 'Estudiantes impactados', 'int', 1]],
};
