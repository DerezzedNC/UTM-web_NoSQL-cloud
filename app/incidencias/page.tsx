"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { CATEGORIA_META, PRIORIDAD_META } from "@/lib/incidencias/constants";
import type { IncidenciaDetalle } from "@/lib/incidencias/mock-data";
import type { CategoriaIncidencia, EstadoIncidencia, Prioridad } from "@/lib/incidencias/types";

const estados: { value: "" | EstadoIncidencia; label: string }[] = [
  { value: "", label: "Todos" }, { value: "abierta", label: "abierta" }, { value: "en proceso", label: "en proceso" },
  { value: "en espera", label: "en espera" }, { value: "resuelta", label: "resuelta" }, { value: "cerrada", label: "cerrada" },
];
const stateStyle: Record<EstadoIncidencia, string> = { abierta: "bg-teal-50 text-teal-700", "en proceso": "bg-emerald-50 text-emerald-700", "en espera": "bg-slate-100 text-slate-600", resuelta: "bg-emerald-50 text-emerald-700", cerrada: "bg-slate-100 text-slate-500" };
const priorityBorder: Record<Prioridad, string> = { critica: "border-l-red-600", alta: "border-l-orange-500", media: "border-l-yellow-400", baja: "border-l-emerald-500" };
const stateSelectClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

function cardBorderClass(ticket: IncidenciaDetalle) {
  return ticket.estado === "resuelta" || ticket.estado === "cerrada"
    ? "border-l-slate-400"
    : priorityBorder[ticket.prioridad as Prioridad];
}

export default function IncidenciasPage() {
  const { session } = useSession();
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState<"" | CategoriaIncidencia>("");
  const [estado, setEstado] = useState<"" | EstadoIncidencia>("");
  const [edificio, setEdificio] = useState("");
  const [data, setData] = useState<IncidenciaDetalle[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, categoria, estado, edificio });
      fetch(`/api/incidencias/buscar?${params}`).then((r) => { if (!r.ok) throw new Error("No se pudieron cargar las incidencias."); return r.json() as Promise<{ data: IncidenciaDetalle[] }>; }).then((body) => { setData(body.data); setError(""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Error de consulta."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [categoria, edificio, estado, query]);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Centro de atención</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Incidencias</h1><p className="mt-1 text-slate-500">Consulta y da seguimiento a los reportes del campus.</p></div>
        {session && (session.role === "reportante" || session.role === "admin") ? <Link href="/incidencias/nueva" className="rounded-lg bg-[#11695c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d5449]">+ Reportar incidencia</Link> : null}
      </div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-xs"><div className="grid gap-2 md:grid-cols-[1fr_130px_140px_150px_82px]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título o descripción" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as "" | EstadoIncidencia)} className={stateSelectClass}><option value="">Todos</option>{estados.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value as "" | CategoriaIncidencia)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Área</option>{Object.entries(CATEGORIA_META).map(([key, value]) => <option key={key} value={key}>{value.etiqueta}</option>)}</select>
        <input value={edificio} onChange={(e) => setEdificio(e.target.value)} placeholder="Edificio" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="button" className="rounded-lg bg-[#11695c] px-3 py-2 text-sm font-medium text-white hover:bg-[#0d5449]">Buscar</button>
      </div></section>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-slate-500" aria-label="Significado de colores">
        <span className="font-semibold text-slate-700">Prioridad:</span>
        <LegendItem color="bg-red-500" label="Crítica" />
        <LegendItem color="bg-orange-500" label="Alta" />
        <LegendItem color="bg-yellow-400" label="Media" />
        <LegendItem color="bg-emerald-500" label="Baja" />
        <LegendItem color="bg-slate-400" label="Finalizado" />
      </div>
      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-5 space-y-3">{data.map((ticket) => <Link key={ticket._id} href={`/incidencias/${ticket._id}`} className={`block rounded-xl border border-slate-200 border-l-4 ${cardBorderClass(ticket)} bg-white px-4 py-3 shadow-xs hover:border-slate-300 hover:shadow-sm`}>
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono font-bold text-slate-700">{ticket.folio}</span><span className={`rounded-full px-2 py-0.5 font-medium ${stateStyle[ticket.estado]}`}>{ticket.estado}</span><span className="text-slate-400">{CATEGORIA_META[ticket.categoria].etiqueta} · prioridad {PRIORIDAD_META[ticket.prioridad].etiqueta.toLowerCase()}</span></div>
        <h2 className="mt-1 font-semibold text-slate-900">{ticket.titulo}</h2><p className="mt-1 text-xs text-slate-400">{ticket.ubicacion.edificio} · {new Date(ticket.fecha_creacion).toLocaleDateString("es-MX")}</p>
      </Link>)}{!data.length && !error ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No hay incidencias.</div> : null}</div>
    </div></main>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}
