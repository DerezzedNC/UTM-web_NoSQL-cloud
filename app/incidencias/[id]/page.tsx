"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { CATEGORIA_META, PRIORIDAD_META } from "@/lib/incidencias/constants";
import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";
import { canCloseTicket, hasPermission } from "@/lib/rbac";
import type { EstadoIncidencia, IncidenciaCampus } from "@/lib/incidencias/types";

const estados: EstadoIncidencia[] = ["abierta", "en proceso", "en espera", "resuelta", "cerrada"];
const stateStyle: Record<EstadoIncidencia, string> = { abierta: "bg-teal-50 text-teal-700", "en proceso": "bg-emerald-50 text-emerald-700", "en espera": "bg-amber-50 text-amber-700", resuelta: "bg-emerald-50 text-emerald-700", cerrada: "bg-slate-100 text-slate-600" };
const stateSelectClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function IncidenciaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = useSession();
  const [ticket, setTicket] = useState<IncidenciaCampus>();
  const [estado, setEstado] = useState<EstadoIncidencia>("en proceso");
  const [horas, setHoras] = useState("0");
  const [autor, setAutor] = useState("");
  const [comentario, setComentario] = useState("");
  const [tag, setTag] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const canUpdate = Boolean(session && hasPermission(session.role, "incidencia:update"));
  const canManageTags = Boolean(session && hasPermission(session.role, "incidencia:tags"));
  const canUpload = Boolean(session && hasPermission(session.role, "evidencia:upload"));
  const availableStates = estados.filter((item) => item !== "cerrada" || Boolean(session && canCloseTicket(session.role)));

  useEffect(() => {
    params.then(({ id }) => setTicket(INCIDENCIAS_INICIALES.find((item) => item._id === id || item.folio === id)));
  }, [params]);

  const detailRows = useMemo(() => {
    if (!ticket) return [];
    const detail = ticket.detalle_especifico;
    if ("direccion_ip" in detail) return [["Dirección IP", detail.direccion_ip], ["VLAN", detail.vlan], ["Puerto uplink", detail.puerto_uplink], ["Equipos afectados", detail.equipos_afectados]];
    if ("tipo_dano" in detail) return [["Tipo de daño", detail.tipo_dano], ["Riesgo", detail.riesgo_seguridad], ["Requiere insumos", detail.requiere_insumos ? "Sí" : "No"], ["Contratista externo", detail.contratista_externo ? "Sí" : "No"]];
    return [["Plataforma", detail.plataforma], ["Código de curso", detail.codigo_curso], ["Periodo escolar", detail.periodo_escolar], ["Estudiantes impactados", detail.estudiantes_impactados]];
  }, [ticket]);

  async function submitStatus(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate) return setNotice("Esta función requiere el rol Técnico, Coordinador o Administrador.");
    if (!ticket || !autor.trim() || !comentario.trim() || Number(horas) < 0) return setNotice("Completa autor, comentario y horas válidas.");
    const response = await fetch(`/api/incidencias/${ticket._id}/estado`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-user-role": session?.role ?? "" }, body: JSON.stringify({ estado_nuevo: estado, horas_sumadas: Number(horas), comentario, autor }) });
    const body = await response.json() as { data?: IncidenciaCampus; error?: string };
    if (!response.ok || !body.data) return setNotice(body.error ?? "No se pudo actualizar.");
    setTicket(body.data); setComentario(""); setHoras("0"); setNotice("Actualización atómica aplicada.");
  }

  async function updateTag(action: "add" | "remove", value: string) {
    if (!canManageTags) return setNotice("Esta función requiere el rol Técnico, Coordinador o Administrador.");
    if (!ticket || !value.trim()) return;
    const response = await fetch(`/api/incidencias/${ticket._id}/tags`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-user-role": session?.role ?? "" }, body: JSON.stringify({ action, tag: value.trim() }) });
    const body = await response.json() as { data?: string[]; error?: string };
    if (!response.ok || !body.data) return setNotice(body.error ?? "No se pudieron actualizar las etiquetas.");
    setTicket({ ...ticket, tags: body.data }); setTag(""); setNotice("Etiquetas actualizadas.");
  }

  async function uploadEvidence(event: FormEvent) {
    event.preventDefault();
    if (!canUpload) return setNotice("Esta función requiere el rol Reportante, Técnico o Administrador.");
    if (!ticket || !file) return;
    if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type) || file.size > 5 * 1024 * 1024) return setNotice("Solo se permiten PNG, JPG o PDF de hasta 5 MB.");
    const response = await fetch(`/api/incidencias/${ticket._id}/evidencias`, { method: "POST", headers: { "Content-Type": "application/json", "x-user-role": session?.role ?? "" }, body: JSON.stringify({ nombre_archivo: file.name, tipo_mime: file.type, peso_kb: Math.ceil(file.size / 1024), url_storage: `incidencias/${ticket.folio}/${file.name}` }) });
    const body = await response.json() as { data?: IncidenciaCampus["evidencias_adjuntas"][number]; error?: string };
    if (!response.ok || !body.data) return setNotice(body.error ?? "No se pudo cargar la evidencia.");
    setTicket({ ...ticket, evidencias_adjuntas: [...ticket.evidencias_adjuntas, body.data] }); setFile(null); setNotice("Evidencia agregada.");
  }

  if (!ticket) return <main className="min-h-screen bg-slate-50 p-8 text-slate-600">Cargando expediente...</main>;
  return (
    <main className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50/80 via-slate-50 to-teal-50/40 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-5xl"><Link href="/incidencias" className="font-semibold text-teal-700">← Incidencias</Link>
        <header className="mt-5 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-600">{ticket.folio}</span><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${stateStyle[ticket.estado]}`}>{ticket.estado}</span><span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold">{PRIORIDAD_META[ticket.prioridad].etiqueta}</span><span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">{CATEGORIA_META[ticket.categoria].etiqueta}</span></div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-800">{ticket.titulo}</h1><p className="mt-2 max-w-3xl text-slate-600">{ticket.descripcion}</p><p className="mt-3 font-mono text-xs text-slate-500">Creada: {ticket.fecha_creacion}{ticket.fecha_resolucion ? ` · Resuelta: ${ticket.fecha_resolucion}` : ""}</p></div><div className="rounded-2xl bg-teal-50 px-5 py-3 text-center"><p className="text-xs font-bold uppercase tracking-wider text-teal-600">Horas invertidas</p><p className="mt-1 text-2xl font-bold text-teal-800">{ticket.horas_invertidas}</p></div></div>
        </header>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2"><section className="grid gap-4 sm:grid-cols-2"><InfoCard title="Reportante"><p className="font-semibold text-slate-900">{ticket.reportante.nombre}</p><p>{ticket.reportante.rol}</p><p className="font-mono text-xs">{ticket.reportante.correo}</p><p className="font-mono text-xs">{ticket.reportante.id_usuario}</p></InfoCard><InfoCard title="Ubicación"><p className="font-semibold text-slate-900">{ticket.ubicacion.edificio}</p><p>{ticket.ubicacion.piso} · {ticket.ubicacion.aula_laboratorio}</p></InfoCard></section>
            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Detalle específico · {CATEGORIA_META[ticket.categoria].etiqueta}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{detailRows.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>)}</div></section>
            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Bitácora de seguimiento</h2><div className="mt-5 space-y-5 border-l-2 border-teal-100 pl-5">{ticket.historial_seguimiento.map((item) => <div key={`${item.fecha}-${item.autor}`} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-teal-50" /><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{item.fecha}</span><span className={`rounded px-2 py-1 text-xs font-semibold ${stateStyle[item.estado_nuevo]}`}>{item.estado_nuevo}</span><span className="text-xs font-semibold text-slate-700">{item.autor} · +{item.horas_sumadas} h</span></div><p className="mt-2 text-sm text-slate-600">{item.comentario}</p></div>)}</div></section>
          </div>
          <aside className="space-y-6">
            {canUpdate ? <OperationCard title="Actualizar estado">
              <form onSubmit={submitStatus} className="mt-4 space-y-3"><label className="block text-xs font-semibold text-slate-600" htmlFor="estado-nuevo">Estado</label><select id="estado-nuevo" value={estado} onChange={(e) => setEstado(e.target.value as EstadoIncidencia)} className={stateSelectClass}>{availableStates.map((item) => <option key={item}>{item}</option>)}</select><input type="number" min="0" step="0.1" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Horas" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><input value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Autor" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario" className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><button className="w-full rounded-lg bg-[#11695c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d5449]">Guardar</button></form>
            </OperationCard> : null}
            <OperationCard title="Etiquetas"><div className="mt-4 flex flex-wrap gap-2">{ticket.tags.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">#{item}{canManageTags ? <button type="button" onClick={() => updateTag("remove", item)} className="ml-2 font-bold text-slate-400 hover:text-red-600">×</button> : null}</span>)}</div>{canManageTags ? <div className="mt-4 flex gap-2"><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nueva etiqueta" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={() => updateTag("add", tag)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">Agregar</button></div> : null}</OperationCard>
            <OperationCard title="Evidencias"><ul className="mt-4 space-y-2 text-xs">{ticket.evidencias_adjuntas.map((item) => <li key={item.url_storage} className="rounded-lg bg-slate-50 p-3"><p className="font-semibold text-slate-900">{item.nombre_archivo}</p><p className="mt-1 text-slate-500">{item.tipo_mime} · {item.peso_kb} KB</p><a href={item.url_storage} className="mt-1 block truncate text-teal-700 hover:underline">{item.url_storage}</a></li>)}</ul>{canUpload ? <form onSubmit={uploadEvidence} className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-sm text-slate-600">PNG, JPG o PDF</p><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-3 w-full text-xs" /><button className="mt-3 w-full rounded-lg bg-[#11695c] px-3 py-2 text-sm font-medium text-white">Cargar</button></form> : null}</OperationCard>
          </aside>
        </div>
        {notice ? <p role="status" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">{notice}</p> : null}
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p><div className="mt-3 space-y-1 text-sm text-slate-600">{children}</div></section>;
}

function OperationCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"><h2 className="font-semibold text-slate-900">{title}</h2>{children}</section>;
}
