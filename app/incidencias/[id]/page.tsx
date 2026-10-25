"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIA_META, PRIORIDAD_META } from "@/lib/incidencias/constants";
import { INCIDENCIAS_INICIALES, type EstadoIncidencia, type IncidenciaDetalle, type RolUsuario } from "@/lib/incidencias/mock-data";
import { addDemoEvidence, readDemoIncidencias, updateDemoStatus, updateDemoTags } from "@/lib/incidencias/demo-store";
import { Can, RBACProvider } from "@/components/auth/Can";

const estados: EstadoIncidencia[] = ["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"];
const estadoLabel: Record<EstadoIncidencia, string> = { abierta: "Abierta", en_proceso: "En proceso", en_espera: "En espera", resuelta: "Resuelta", cerrada: "Cerrada" };
const roles: RolUsuario[] = ["admin", "directiva", "coordinador", "tecnico", "reportante"];

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const colors: Record<string, string> = { slate: "bg-slate-100 text-slate-600", red: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700", teal: "bg-teal-50 text-teal-700" };
  return <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${colors[tone] ?? colors.slate}`}>{children}</span>;
}

function DetailSpecific({ ticket }: { ticket: IncidenciaDetalle }) {
  const detail = ticket.detalle_especifico;
  const rows = "direccion_ip" in detail
    ? [["Dirección IP", detail.direccion_ip], ["VLAN", detail.vlan], ["Puerto uplink", detail.puerto_uplink], ["Equipos afectados", detail.equipos_afectados.join(", ")]]
    : "tipo_dano" in detail
      ? [["Tipo de daño", detail.tipo_dano], ["Riesgo", detail.riesgo_seguridad], ["Requiere insumos", detail.requiere_insumos ? "Sí" : "No"], ["Insumos", detail.insumos_solicitados.join(", ") || "Ninguno"], ["Contratista externo", detail.contratista_externo ? "Sí" : "No"]]
      : [["Plataforma", detail.plataforma], ["Código de curso", detail.codigo_curso], ["Periodo escolar", detail.periodo_escolar], ["Estudiantes impactados", detail.estudiantes_impactados]];
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Telemetría polimórfica · {CATEGORIA_META[ticket.categoria].etiqueta}</p><div className="space-y-2">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-xs last:border-0 last:pb-0"><span className="text-slate-400">{label}</span><b className="max-w-[58%] text-right text-slate-700">{value}</b></div>)}</div></section>;
}

function daysLeft(fecha: string | undefined, now: number | null) {
  if (!fecha) return 60;
  if (!now) return 60;
  return Math.max(0, 60 - Math.floor((now - new Date(fecha).getTime()) / 86400000));
}

export default function IncidenciaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [data, setData] = useState(INCIDENCIAS_INICIALES);
  const [now, setNow] = useState<number | null>(null);
  const [rol, setRol] = useState<RolUsuario>("admin");
  const [selectedFolio, setSelectedFolio] = useState(INCIDENCIAS_INICIALES[0].folio);
  const [tagInput, setTagInput] = useState("");
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoIncidencia>("en_proceso");
  const [horas, setHoras] = useState("0");
  const [comentario, setComentario] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentPriority, setAssignmentPriority] = useState(INCIDENCIAS_INICIALES[0].prioridad);

  useEffect(() => { params.then((value) => setId(value.id)); }, [params]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      setData(readDemoIncidencias());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const ticket = useMemo(() => data.find((item) => item._id === id || item.folio === id) ?? data.find((item) => item.folio === selectedFolio) ?? data[0], [data, id, selectedFolio]);
  const canAssign = rol === "admin" || rol === "coordinador";
  const canTags = canAssign || rol === "tecnico";
  const canEvidence = rol === "admin" || rol === "tecnico" || rol === "reportante";
  const canFollowUp = rol === "admin" || rol === "tecnico";

  async function updateTags(action: "add" | "remove", tag: string) {
    const updated = updateDemoTags(ticket._id, action, tag.trim());
    if (!updated) { setNotice("No se pudo actualizar las etiquetas."); return; }
    setData((current) => current.map((item) => item._id === ticket._id ? updated : item));
    setTagInput("");
    setNotice("Etiquetas actualizadas con $addToSet / $pull.");
  }

  async function submitFollowUp(event: React.FormEvent) {
    event.preventDefault();
    if (!comentario.trim() || !Number.isFinite(Number(horas)) || Number(horas) < 0) {
      setNotice("Completa un comentario y una cantidad de horas válida.");
      return;
    }
    const updated = updateDemoStatus(ticket._id, estadoNuevo, Number(horas), comentario, rol);
    if (!updated) { setNotice("No se pudo registrar el seguimiento."); return; }
    setData((current) => current.map((item) => item._id === ticket._id ? updated : item));
    setComentario(""); setHoras("0"); setNotice("Seguimiento registrado. Se actualizaron estado, bitácora y horas.");
  }

  async function uploadEvidence(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice("Solo se permiten PNG, JPEG o PDF de hasta 5 MB.");
      return;
    }
    const evidence: IncidenciaDetalle["evidencias_adjuntas"][number] = {
      nombre_archivo: file.name,
      tipo_mime: file.type as "image/png" | "image/jpeg" | "application/pdf",
      peso_kb: Math.ceil(file.size / 1024),
      fecha_carga: new Date().toLocaleString("es-MX"),
      storage_key: `demo/${ticket.folio}/${file.name}`,
    };
    const updated = addDemoEvidence(ticket._id, evidence);
    if (!updated) { setNotice("No se pudo agregar la evidencia."); return; }
    setData((current) => current.map((item) => item._id === ticket._id ? updated : item));
    setFile(null); setNotice("Evidencia agregada al expediente.");
  }

  return <RBACProvider role={rol}><div className="min-h-screen bg-[#f8f7ff] text-slate-800">
    <div className="border-b border-slate-200 bg-white px-5 py-3"><div className="mx-auto flex max-w-[1380px] items-center justify-between"><Link href="/incidencias" className="text-xs font-bold text-teal-700">← Bandeja</Link><div className="flex items-center gap-3 text-[10px]"><span className="font-bold uppercase tracking-widest text-slate-400">Sede activa</span><b>Campus Central UTM</b><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">● Sync real-time</span><span className="rounded-full bg-teal-800 px-2 py-1 text-white">CM</span></div></div></div>
    <main className="mx-auto max-w-[1380px] p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xl font-bold text-teal-800">{ticket.folio}</span><Badge tone="red">{PRIORIDAD_META[ticket.prioridad].etiqueta}</Badge><Badge tone={ticket.estado === "resuelta" ? "green" : "amber"}>{estadoLabel[ticket.estado]}</Badge></div><h1 className="mt-2 text-2xl font-bold text-slate-900">{ticket.titulo}</h1><p className="mt-1 text-xs text-slate-500">ID MongoDB: {ticket._id} · {ticket.horas_invertidas} horas invertidas</p></div><div className="flex flex-wrap items-center gap-2"><label className="text-[10px] font-bold uppercase text-slate-400">Probar rol<select value={rol} onChange={(event) => setRol(event.target.value as RolUsuario)} className="ml-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700">{roles.map((item) => <option key={item}>{item}</option>)}</select></label><select value={selectedFolio} onChange={(event) => setSelectedFolio(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option>INC-2026-0001</option><option>INC-2026-0002</option><option>INC-2026-0003</option></select><Can do="dispatch:assign">{canAssign ? <button onClick={() => { setAssignmentPriority(ticket.prioridad); setAssignmentOpen(true); }} className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-bold text-white">Asignar / Prioridad</button> : null}</Can></div></div>
      {ticket.estado === "resuelta" ? <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"><b>Índice TTL activo</b><span>Este expediente se eliminará en {daysLeft(ticket.fecha_resolucion, now)} días desde fecha_resolucion.</span></div> : null}
      {notice ? <div className="mb-4 rounded-lg bg-indigo-50 px-4 py-2 text-xs text-indigo-700">{notice}</div> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Descripción de la incidencia</h2><span className="text-[10px] text-slate-400">CU-02 · Evidencias adjuntas</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{ticket.descripcion}</p><div className="mt-5 border-t border-slate-100 pt-4">          <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Galería de evidencias ({ticket.evidencias_adjuntas.length})</p>{canEvidence ? <Can do="evidence:upload"><form onSubmit={uploadEvidence} className="flex items-center gap-2"><label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600">+ Cargar evidencia<input type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{file ? <button className="rounded-md bg-teal-700 px-2 py-1.5 text-[10px] font-bold text-white">Subir</button> : null}</form></Can> : null}</div><div className="grid gap-3 sm:grid-cols-2">{ticket.evidencias_adjuntas.map((evidencia) => <div key={evidencia.storage_key} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex h-24 items-center justify-center rounded-md bg-slate-200 text-3xl text-slate-400">{evidencia.tipo_mime === "application/pdf" ? "▤" : "▧"}</div><p className="mt-2 truncate text-xs font-bold text-slate-700">{evidencia.nombre_archivo}</p><p className="mt-1 text-[10px] text-slate-400">{evidencia.tipo_mime} · {evidencia.peso_kb} KB</p><p className="text-[10px] text-slate-400">{evidencia.fecha_carga}</p><p className="mt-1 truncate font-mono text-[9px] text-teal-700" title={evidencia.storage_key}>storage_key: {evidencia.storage_key}</p></div>)}</div></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Bitácora de Eventos NoSQL</h2><p className="mt-1 text-[10px] text-slate-400">historial_seguimiento[] · Inmutable document ledger</p></div><Badge tone="teal">{ticket.historial_seguimiento.length} eventos</Badge></div><div className="mt-5 space-y-4">{ticket.historial_seguimiento.map((event) => <article key={`${event.fecha}-${event.autor}`} className="relative border-l-2 border-teal-200 pl-5"><span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-white bg-teal-700" /><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-800">{event.autor}</p><span className="text-[10px] text-slate-400">{event.fecha}</span></div><div className="mt-1 flex gap-2"><Badge tone="blue">{estadoLabel[event.estado_nuevo]}</Badge><Badge tone="slate">+{event.horas_sumadas} h</Badge></div><p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{event.comentario}</p></article>)}</div></section>
          {canFollowUp ? <Can do="ticket:update"><form onSubmit={submitFollowUp} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Nuevo Registro de Seguimiento</h2><p className="mt-1 text-xs text-slate-500">La actualización usa $inc para horas_invertidas y agrega un evento a la bitácora.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Estado nuevo<select value={estadoNuevo} onChange={(event) => setEstadoNuevo(event.target.value as EstadoIncidencia)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">{estados.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Horas sumadas<input type="number" min="0" step="0.1" value={horas} onChange={(event) => setHoras(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700" /></label></div><textarea required value={comentario} onChange={(event) => setComentario(event.target.value)} placeholder="Describe la intervención técnica realizada..." className="mt-3 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-teal-500" /><button className="mt-3 rounded-lg bg-teal-800 px-4 py-2.5 text-xs font-bold text-white">Registrar en Ledger NoSQL</button></form></Can> : null}
        </div>
        <aside className="space-y-5"><DetailSpecific ticket={ticket} /><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Etiquetas operativas</p><div className="flex flex-wrap gap-1.5">{ticket.tags.map((tag) => <button key={tag} disabled={!canTags} onClick={() => updateTags("remove", tag)} className="rounded-md bg-teal-50 px-2 py-1 text-[10px] font-semibold text-teal-700">#{tag}{canTags ? " ×" : ""}</button>)}</div>{canTags ? <div className="mt-3 flex gap-2"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Nueva etiqueta" className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs" /><button onClick={() => tagInput.trim() && updateTags("add", tagInput.trim())} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-white">Añadir</button></div> : <p className="mt-2 text-[10px] text-slate-400">Solo roles con permisos de operación pueden editar tags.</p>}</section><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Punto de servicio</p><p className="text-sm font-bold text-slate-800">⌖ {ticket.ubicacion.edificio} · {ticket.ubicacion.piso}</p><p className="mt-1 text-xs text-slate-500">{ticket.ubicacion.aula_laboratorio}</p><div className="mt-4 border-t border-slate-100 pt-3"><p className="text-[10px] text-slate-400">Reportante</p><p className="mt-1 text-xs font-bold">{ticket.reportante.nombre}</p><p className="text-[11px] text-slate-500">{ticket.reportante.cargo}<br />{ticket.reportante.correo}</p></div></section><section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Técnico asignado</p>{ticket.tecnico_asignado ? <><p className="text-sm font-bold">{ticket.tecnico_asignado.nombre}</p><p className="mt-1 text-xs text-slate-500">{ticket.tecnico_asignado.correo}<br />Área: {ticket.tecnico_asignado.area}<br />ID: {ticket.tecnico_asignado.id_usuario}</p></> : <p className="text-xs italic text-slate-400">Sin técnico asignado</p>}</section></aside>
      </div>
    </main>
    {assignmentOpen ? <div className="fixed inset-0 z-10 grid place-items-center bg-slate-950/30 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><div className="flex justify-between"><h2 className="font-bold">Asignar técnico y ajustar prioridad</h2><button onClick={() => setAssignmentOpen(false)}>×</button></div><p className="mt-3 text-xs text-slate-500">Este modal representa la operación atómica sobre tecnico_asignado y prioridad.</p><label className="mt-4 block text-xs font-semibold">Prioridad<select value={assignmentPriority} onChange={(event) => setAssignmentPriority(event.target.value as IncidenciaDetalle["prioridad"])} className="mt-1 w-full rounded-md border p-2 text-xs">{Object.keys(PRIORIDAD_META).map((item) => <option key={item}>{item}</option>)}</select></label><button onClick={() => { setData((current) => current.map((item) => item._id === ticket._id ? { ...item, prioridad: assignmentPriority } : item)); setAssignmentOpen(false); setNotice("Asignación y prioridad actualizadas."); }} className="mt-4 w-full rounded-lg bg-teal-800 px-3 py-2 text-xs font-bold text-white">Guardar cambios</button></div></div> : null}
  </div></RBACProvider>;
}
