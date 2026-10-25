"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIA_META, PRIORIDAD_META } from "@/lib/incidencias/constants";
import {
  INCIDENCIAS_INICIALES,
  type IncidenciaDetalle,
} from "@/lib/incidencias/mock-data";
import type { Prioridad } from "@/lib/incidencias/types";
import { Can, RBACProvider } from "@/components/auth/Can";
import { useSession } from "@/components/auth/SessionProvider";
import { readDemoIncidencias } from "@/lib/incidencias/demo-store";

type StatusFilter = "todos" | "abierta" | "en_proceso" | "resuelta";
const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abierta", label: "Abiertos" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "resuelta", label: "Resueltos" },
];
const priorityFilters: { value: Prioridad | "todas"; label: string; dot: string }[] = [
  { value: "todas", label: "Todas", dot: "bg-slate-400" },
  { value: "critica", label: "Crítica", dot: "bg-rose-500" },
  { value: "alta", label: "Alta", dot: "bg-orange-400" },
  { value: "media", label: "Media", dot: "bg-blue-400" },
  { value: "baja", label: "Baja", dot: "bg-slate-400" },
];

export default function IncidenciasPage() {
  const { session } = useSession();
  const role = session?.role ?? "coordinador";
  const roleLabel = role === "tecnico" ? "Técnico" : role === "directiva" ? "Directiva" : role === "admin" ? "Super Admin" : "Coordinador";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [priority, setPriority] = useState<Prioridad | "todas">("todas");
  const [selectedIds, setSelectedIds] = useState<string[]>([INCIDENCIAS_INICIALES[1]?._id ?? INCIDENCIAS_INICIALES[0]._id]);
  const [notice, setNotice] = useState("");
  const [incidencias, setIncidencias] = useState(INCIDENCIAS_INICIALES);

  useEffect(() => {
    const refresh = () => setIncidencias(readDemoIncidencias());
    refresh();
    window.addEventListener("utm-demo-incidencias-updated", refresh);
    return () => window.removeEventListener("utm-demo-incidencias-updated", refresh);
  }, []);

  const tickets = useMemo(() => {
    const normalized = query.toLocaleLowerCase("es-MX");
    return incidencias.filter((ticket) => {
      const searchable = [
        ticket.folio,
        ticket.titulo,
        ticket.descripcion,
        ticket.ubicacion.edificio,
        ticket.ubicacion.aula_laboratorio,
        ticket.tecnico_asignado?.nombre ?? "",
        ...ticket.tags,
      ].join(" ").toLocaleLowerCase("es-MX");
      return searchable.includes(normalized)
        && (status === "todos" || (status === "resuelta" ? ticket.estado === "resuelta" || ticket.estado === "cerrada" : ticket.estado === status))
        && (priority === "todas" || ticket.prioridad === priority);
    });
  }, [incidencias, priority, query, status]);

  const selected = tickets.find((ticket) => ticket._id === selectedIds[0]) ?? tickets[0];
  const active = incidencias.filter((ticket) => ticket.estado !== "resuelta" && ticket.estado !== "cerrada");
  const urgent = active.filter((ticket) => ticket.prioridad === "critica" || ticket.prioridad === "alta");
  const firstContact = Math.round((incidencias.filter((ticket) => ticket.estado === "resuelta").length / incidencias.length) * 1000) / 10;

  function quickAction(label: string) {
    setNotice(`${label}: operación registrada en la bitácora de coordinación.`);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function toggleTicket(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedTicketId) => selectedTicketId !== id)
      : [...current, id]);
  }

  function toggleAllTickets() {
    setSelectedIds((current) => current.length === tickets.length ? [] : tickets.map((ticket) => ticket._id));
  }

  return (
    <RBACProvider role={role}>
    <div className="min-h-[calc(100vh-73px)] bg-[#f8f7ff] text-slate-800">
      <div className="flex min-h-[calc(100vh-73px)]">
        <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-[#f0f1ff] px-2 py-4 md:flex md:flex-col">
          <Link href="/" className="mb-7 flex items-center gap-2 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-[10px] font-bold text-white">UTM</span>
            <span><b className="block text-xs">UTM Desk</b><small className="font-mono text-[8px] tracking-widest text-slate-400">NoSQL CLOUD OPS</small></span>
          </Link>
          <p className="px-2 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Role scope</p>
          <span className="mt-2 block rounded bg-teal-700 px-2 py-1 text-center text-[8px] font-bold uppercase tracking-wider text-white">{roleLabel}</span>
          <nav className="mt-4 space-y-1 text-[10px] font-semibold">
            <Link href="/incidencias" className="block rounded-md bg-teal-700 px-2 py-2.5 text-white">▣ &nbsp;{role === "tecnico" ? "Consola Técnica" : role === "directiva" ? "Supervisión de Tickets" : "Bandeja de Tickets"}</Link>
            <Link href="/activos" className="block rounded-md px-2 py-2.5 text-slate-700 hover:bg-white">▥ &nbsp;Bitácora & Activos</Link>
            <span className="block rounded-md px-2 py-2.5 text-slate-700">▥ &nbsp;Dashboard Ejecutivo</span>
          </nav>
          <div className="mt-auto rounded-lg bg-white p-2 text-[8px] shadow-sm"><p className="font-mono text-slate-500">NoSQL Engine <span className="float-right text-emerald-600">Active</span></p><div className="mt-2 h-1 rounded bg-teal-600" /><p className="mt-1 text-slate-400">Write IOPS <span className="float-right">1.2k/s</span></p></div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 sm:px-7">
            <div><p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Sede activa</p><p className="text-xs font-bold text-slate-700">Campus Central UTM⌄</p></div>
            <div className="flex items-center gap-2 text-[9px]"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">● Sync: Cluster-Node 04 (Real-time)</span><span className="text-slate-500">Lic. Mariana Valenzuela</span><span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-white">MV</span></div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div><p className="font-mono text-[8px] text-slate-500">Infraestructura &gt; {role === "tecnico" ? "Operación Técnica" : role === "directiva" ? "Supervisión Ejecutiva" : "Supervisión Operativa"} &gt; Bandeja de Tickets</p><h1 className="mt-1 max-w-lg text-xl font-bold leading-tight text-slate-900">{role === "tecnico" ? "Consola Técnica Operativa" : role === "directiva" ? "Supervisión de Incidencias" : "Supervisión Operativa & Asignación de Cuadrillas - Triage"}</h1></div>
              <div className="flex gap-2"><span className="rounded bg-emerald-50 px-2 py-2 font-mono text-[8px] text-emerald-700">Cluster<br />Sync OK</span><span className="rounded bg-indigo-50 px-2 py-2 font-mono text-[8px] text-indigo-700">⚙ DocStore: tickets_v3.replicated</span><button type="button" onClick={() => quickAction("Exportar JSON")} className="rounded bg-indigo-100 px-3 py-2 text-[9px] font-bold text-indigo-800">⇩ Exportar<br />JSON</button><button type="button" onClick={() => quickAction(`Asignar cuadrilla a ${selectedIds.length} ticket(s)`)} className="rounded bg-teal-800 px-3 py-2 text-[9px] font-bold text-white">♧ Asignar<br />Cuadrilla</button></div>
            </div>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Tickets Activos" value={String(active.length + 19)} detail={`${active.length} en cola viva`} footer="Capacidad de atención" progress={78} color="teal" />
              <Metric label="Riesgo Inminente SLA" value={`0${urgent.length}`} detail="< 30 min" footer="P99 Umbral de quiebre" progress={urgent.length ? 70 : 18} color="rose" />
              <Metric label="MTTR Promedio" value="42 min" detail="↓ -8.4 min" footer="Delta semanal" progress={65} color="teal" />
              <Metric label="Resolución Primer Contacto" value={`${firstContact || 94.2}%`} detail="+4.2% excelente" footer="Meta institucional: 90%" progress={94} color="emerald" />
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-[10px] text-slate-400">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ID (UTM-...), aula, facultad, switch o técnico..." className="min-w-0 flex-1 bg-transparent outline-none" /><kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[8px]">⌘K</kbd></label>
                <span className="text-[9px] text-slate-500">Prioridad:</span>
                {priorityFilters.filter((item) => item.value !== "todas").map((item) => <button type="button" key={item.value} onClick={() => setPriority(priority === item.value ? "todas" : item.value)} className={`rounded px-2 py-1 text-[9px] font-bold ${priority === item.value ? "bg-teal-50 text-teal-800" : "bg-indigo-50 text-slate-600"}`}><i className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${item.dot}`} />{item.label}</button>)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2">{statusTabs.map((item) => <button type="button" key={item.value} onClick={() => setStatus(item.value)} className={`rounded px-3 py-1.5 text-[9px] font-semibold ${status === item.value ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-50"}`}>{item.label} <span className="ml-1 rounded bg-emerald-100 px-1 text-[8px] text-emerald-700">{item.value === "todos" ? incidencias.length : tickets.filter((ticket) => ticket.estado === item.value).length}</span></button>)}<span className="ml-auto text-[9px] text-slate-500">Filtro activo: <b className="text-teal-700">{query || priority !== "todas" ? "Personalizado" : "Campus Central"}</b></span></div>
            </section>

            {notice ? <p className="mt-3 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] text-teal-800">{notice}</p> : null}

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto"><table className="w-full min-w-[610px] text-left text-[10px]"><thead className="bg-[#f0f1ff] font-mono text-[8px] uppercase tracking-wide text-slate-500"><tr><th className="w-10 px-3 py-3"><input type="checkbox" checked={tickets.length > 0 && selectedIds.length === tickets.length} onChange={toggleAllTickets} aria-label="Seleccionar todos" /></th><th className="px-3 py-3">Ticket ID & Severidad</th><th className="px-3 py-3">Incidencia / Categoría</th><th className="px-3 py-3">Ubicación UTM</th></tr></thead><tbody className="divide-y divide-slate-100">{tickets.map((ticket) => <TicketRow key={ticket._id} ticket={ticket} selected={selectedIds.includes(ticket._id)} onSelect={() => toggleTicket(ticket._id)} />)}</tbody></table></div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[8px] text-slate-500"><span>{selectedIds.length} elementos seleccionados</span><button type="button" onClick={() => quickAction(`Asignación masiva de ${selectedIds.length} ticket(s)`)} className="text-teal-700">Asignación <b>masiva</b></button><button type="button" onClick={() => quickAction("Cierre masivo")} className="text-rose-500">Cierre <b>forzoso</b></button><span>Filas por pág: <select className="rounded border border-slate-200 px-1 py-0.5"><option>25</option></select></span><span>1 - {tickets.length} de {incidencias.length} &nbsp;‹ &nbsp;›</span></div>
              </section>
              {selected ? <TicketDetail ticket={selected} onAction={quickAction} /> : <EmptyDetail />}
            </div>
          </div>
        </main>
      </div>
    </div>
    </RBACProvider>
  );
}

function Metric({ label, value, detail, footer, progress, color }: { label: string; value: string; detail: string; footer: string; progress: number; color: "teal" | "rose" | "emerald" }) {
  const styles = { teal: "text-teal-700 bg-teal-100", rose: "text-rose-600 bg-rose-100", emerald: "text-emerald-700 bg-emerald-100" }[color];
  const bar = { teal: "bg-teal-700", rose: "bg-rose-500", emerald: "bg-emerald-500" }[color];
  return <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between"><p className="font-mono text-[8px] font-bold uppercase tracking-widest text-slate-500">{label}</p><span className={`grid h-6 w-6 place-items-center rounded ${styles}`}>◉</span></div><div className="mt-1 flex items-end justify-between"><strong className="text-2xl text-slate-900">{value}</strong><span className={`text-[8px] font-bold ${styles.split(" ")[0]}`}>{detail}</span></div><div className="mt-3 flex justify-between text-[8px] text-slate-500"><span>{footer}</span><span>{color === "rose" ? "Prioridad Nivel 1" : `${progress}%`}</span></div><div className="mt-1 h-1 rounded bg-slate-100"><div className={`h-1 rounded ${bar}`} style={{ width: `${progress}%` }} /></div></article>;
}

function TicketRow({ ticket, selected, onSelect }: { ticket: IncidenciaDetalle; selected: boolean; onSelect: () => void }) {
  const priorityColor = { critica: "text-rose-600", alta: "text-orange-500", media: "text-blue-500", baja: "text-slate-500" }[ticket.prioridad];
  return <tr onClick={onSelect} className={`cursor-pointer transition hover:bg-teal-50 ${selected ? "bg-teal-50/70" : ""}`}><td className="px-3 py-3 align-top"><input type="checkbox" checked={selected} onChange={onSelect} onClick={(event) => event.stopPropagation()} aria-label={`Seleccionar ${ticket.folio}`} /></td><td className="px-3 py-3 align-top"><div className="flex gap-2"><span className={`mt-1 h-8 w-1 rounded ${ticket.prioridad === "critica" ? "bg-rose-500" : ticket.prioridad === "alta" ? "bg-orange-400" : "bg-blue-400"}`} /><div><b className="font-mono text-[10px] text-slate-700">{ticket.folio.replace("INC-2026-00", "#UTM-")}</b><span className={`mt-1 block font-mono text-[8px] font-bold uppercase ${priorityColor}`}>{PRIORIDAD_META[ticket.prioridad].etiqueta}</span></div></div></td><td className="max-w-[260px] px-3 py-3 align-top"><p className="truncate font-semibold text-slate-700">{ticket.titulo}</p><span className="mt-1 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[8px] text-indigo-700">{CATEGORIA_META[ticket.categoria].etiqueta}</span></td><td className="px-3 py-3 align-top text-slate-600"><p>{ticket.ubicacion.aula_laboratorio}</p><span className="text-[8px] text-slate-400">{ticket.ubicacion.edificio} · {ticket.ubicacion.piso}</span></td></tr>;
}

function TicketDetail({ ticket, onAction }: { ticket: IncidenciaDetalle; onAction: (label: string) => void }) {
  return <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3"><div><span className="rounded bg-indigo-50 px-1.5 py-1 font-mono text-[8px] text-indigo-700">{ticket.folio} · {ticket.estado}</span><h2 className="mt-2 text-sm font-bold text-slate-900">{ticket.titulo}</h2></div><button type="button" className="text-slate-500" aria-label="Colapsar detalle">×</button></div>{ticket.prioridad === "critica" || ticket.prioridad === "alta" ? <div className="mt-3 rounded-md bg-rose-50 p-2 text-[9px] text-rose-700">◉ <b>SLA en riesgo: requiere coordinación</b><br /><span className="ml-4">Escalamiento automático nivel 2 disponible.</span></div> : null}<h3 className="mt-4 font-mono text-[8px] uppercase tracking-widest text-slate-500">Punto de servicio</h3><div className="mt-2 rounded bg-indigo-50 p-2 text-[9px]"><b>⌖ {ticket.ubicacion.edificio} · {ticket.ubicacion.aula_laboratorio}</b><p className="mt-1 text-[8px] text-slate-600">Cuadrilla asignada: {ticket.tecnico_asignado?.nombre ?? "Sin asignar"}</p></div><h3 className="mt-4 font-mono text-[8px] uppercase tracking-widest text-slate-500">Bitácora rápida</h3><div className="mt-2 space-y-2 text-[8px] text-slate-600">{ticket.historial_seguimiento.slice(0, 2).map((event) => <p key={event.fecha}>● {event.comentario}<br /><span className="ml-3 font-mono text-slate-400">{event.fecha}</span></p>)}</div>  <div className="mt-4 grid gap-2"><Can do="dispatch:assign"><button type="button" onClick={() => onAction("Despachar Cuadrilla / Reasignar")} className="rounded-md bg-teal-800 px-3 py-2 text-[9px] font-bold text-white">♧ &nbsp;Despachar Cuadrilla / Reasignar</button><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onAction("Escalar a N2")} className="rounded-md bg-indigo-100 px-2 py-2 text-[9px] font-semibold text-slate-700">⇧ Escalar a N2</button><button type="button" onClick={() => onAction("Autorizar Cierre")} className="rounded-md bg-rose-50 px-2 py-2 text-[9px] font-semibold text-rose-700">◉ Autorizar Cierre</button></div></Can></div></aside>;
}

function EmptyDetail() {
  return <aside className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">No hay tickets que coincidan con los filtros activos.</aside>;
}
