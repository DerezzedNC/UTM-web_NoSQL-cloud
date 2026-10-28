export const ESTADOS = ['abierta', 'en_proceso', 'en_espera', 'resuelta', 'cerrada'];
export const ESTADO = { abierta: 'bg-sky-100 text-sky-800', en_proceso: 'bg-amber-100 text-amber-800', en_espera: 'bg-slate-100 text-slate-800', resuelta: 'bg-emerald-100 text-emerald-800', cerrada: 'bg-slate-800 text-white' };
export const PRIO = { baja: 'bg-slate-300', media: 'bg-sky-500', alta: 'bg-amber-500', critica: 'bg-red-600' };
export const CAT = { computo_redes: 'Cómputo y Redes', infraestructura: 'Infraestructura', academico: 'Académico' };
export const lbl = s => s.replace('_', ' ');
export const fecha = d => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
export const inp = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20';
export const btn = 'rounded-lg bg-teal px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/30 disabled:cursor-not-allowed disabled:opacity-50';
export const Badge = ({ v }) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO[v] || 'bg-slate-100 text-slate-800'}`}>{lbl(v)}</span>;
export const Err = ({ m }) => m ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-800">{m}</p> : null;
// Campos del subdocumento polimórfico detalle_especifico (Listado 6): [clave, etiqueta, tipo, ...opciones]
export const DET = {
  computo_redes: [['direccion_ip', 'Dirección IP', 'text'], ['vlan', 'VLAN', 'int', 1, 4094], ['puerto_uplink', 'Puerto uplink', 'text'], ['equipos_afectados', 'Equipos afectados', 'int', 1]],
  infraestructura: [['tipo_dano', 'Tipo de daño', 'text'], ['riesgo_seguridad', 'Riesgo de seguridad', 'sel', ['Bajo', 'Medio', 'Alto', 'Critico']], ['requiere_insumos', 'Requiere insumos', 'bool'], ['insumos_solicitados', 'Insumos (separados por coma)', 'list'], ['contratista_externo', 'Contratista externo', 'bool']],
  academico: [['plataforma', 'Plataforma', 'text'], ['codigo_curso', 'Código de curso', 'text'], ['periodo_escolar', 'Periodo escolar', 'text'], ['estudiantes_impactados', 'Estudiantes impactados', 'int', 1]],
};
