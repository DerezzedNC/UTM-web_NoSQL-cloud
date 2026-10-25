"use client";

import Link from "next/link";
import { useState } from "react";

type Tab = "todas" | "no-leidas" | "criticas" | "tickets";

const tabs: { value: Tab; label: string; count: string }[] = [
  { value: "todas", label: "Todas", count: "8" },
  { value: "no-leidas", label: "No leídas", count: "5" },
  { value: "criticas", label: "Críticas NOC", count: "2" },
  { value: "tickets", label: "Tickets", count: "" },
];

export default function NotificacionesPage() {
  const [tab, setTab] = useState<Tab>("todas");
  const [notice, setNotice] = useState("");
  const [paused, setPaused] = useState(false);

  function action(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  return <main className="relative min-h-screen overflow-hidden bg-[#f3f4fb] text-slate-800">
    <div className="pointer-events-none absolute inset-0 select-none blur-[5px]"><div className="flex min-h-screen"><aside className="hidden w-52 border-r border-slate-200 bg-white p-5 md:block"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-700 text-white">UTM</span><b className="text-sm">UTM Desk</b></div><div className="mt-8 space-y-4 text-xs text-slate-500"><p>▣ Bandeja de Tickets</p><p>⊕ Nueva Incidencia</p><p>▥ Bitácora & Activos</p><p>▤ Dashboard Ejecutivo</p><p>♧ Monitoreo de Red</p><p>⚙ Ajustes del Sistema</p></div></aside><section className="flex-1 p-8"><div className="h-10 rounded-lg bg-white" /><div className="mt-6 h-20 w-2/3 rounded-lg bg-white" /><div className="mt-4 grid grid-cols-3 gap-4"><div className="h-36 rounded-lg bg-white" /><div className="h-36 rounded-lg bg-white" /><div className="h-36 rounded-lg bg-white" /></div><div className="mt-5 h-64 rounded-lg bg-white" /></section></div></div>
    <div className="absolute inset-0 bg-white/35 backdrop-blur-[2px]" />
    <section className="absolute right-3 top-3 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:right-8 sm:top-4">
      <header className="flex items-center gap-2 border-t-4 border-teal-700 border-b border-slate-100 px-4 py-3"><span className="grid h-7 w-7 place-items-center rounded bg-teal-50 text-teal-700">♧</span><h1 className="text-sm font-bold">Centro de Alertas</h1><span className="rounded-full bg-rose-100 px-2 py-1 text-[8px] font-bold text-rose-700">5 nuevas</span><div className="ml-auto flex items-center gap-3 text-slate-500"><button type="button" onClick={() => action("Todas las alertas fueron marcadas como leídas.")} aria-label="Marcar todas como leídas" className="text-sm">✓✓</button><button type="button" onClick={() => action("Filtros de alertas abiertos.")} aria-label="Opciones de alertas" className="text-sm">☷</button><Link href="/incidencias" aria-label="Cerrar centro de alertas" className="text-lg leading-none">×</Link></div></header>
      <div className="flex border-b border-slate-100 bg-[#f0f1ff] px-2 pt-2">{tabs.map((item) => <button type="button" key={item.value} onClick={() => setTab(item.value)} className={`flex-1 border-b-2 px-1 py-2 text-[8px] font-bold ${tab === item.value ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500"}`}>{item.label} {item.count ? `(${item.count})` : ""}</button>)}</div>
      <div className="flex items-center justify-between bg-[#f8f7ff] px-4 py-2 font-mono text-[8px] font-bold text-slate-500"><span>HOY · INCIDENCIAS RECIENTES</span><span className="text-teal-700">3 sin atender</span></div>
      {notice ? <p className="mx-3 mt-2 rounded bg-teal-50 px-2 py-1 text-[8px] text-teal-800">{notice}</p> : null}
      <div className="divide-y divide-slate-100">
        <article className="p-4"><div className="flex gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-rose-100 text-rose-700">⌁</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1"><span className="rounded bg-rose-100 px-1.5 py-1 font-mono text-[7px] font-bold text-rose-700">CRÍTICA NOC</span><span className="rounded bg-slate-100 px-1.5 py-1 font-mono text-[7px]">#UTM-2409</span><span className="ml-auto text-[8px] text-slate-400">◷ Hace 12 min</span></div><h2 className="mt-2 text-[10px] font-bold">Caída de Enlace PoE: SW-UTM-C2 (Lab Cómputo 3)</h2><p className="mt-1 text-[9px] leading-relaxed text-slate-500">Sobrecarga de 785W disparó protección de puerto Gi0/48. Ticket #UTM-2409 creado automáticamente por telemetría.</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[8px]"><span className="text-rose-700">● Origen: Cluster NOC Sentinel</span><Link href="/monitoreo" className="rounded bg-teal-700 px-2 py-1 font-bold text-white">Ver en /monitoreo →</Link></div></div></div></article>
        <article className="p-4"><div className="flex gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-indigo-100 text-indigo-700">◷</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1"><span className="rounded bg-orange-100 px-1.5 py-1 font-mono text-[7px] font-bold text-orange-700">SLA BREACH RISK</span><span className="rounded bg-rose-100 px-1.5 py-1 font-mono text-[7px] font-bold text-rose-700">15 min restantes</span><span className="ml-auto text-[8px] text-slate-400">◷ Hace 34 min</span></div><h2 className="mt-2 text-[10px] font-bold">SLA Crítico (P1): Intervención requerida</h2><p className="mt-1 text-[9px] leading-relaxed text-slate-500">Ticket #UTM-2409 requiere intervención en sitio de técnico especialista antes de incumplir el SLA contractual de campus.</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[8px] font-bold text-rose-700">! Prioridad: P1 Crítica</span><Link href="/incidencias/2409" className="rounded bg-indigo-100 px-2 py-1 text-[8px] font-bold text-indigo-800">Ir a Ticket #UTM-2409 ↗</Link></div></div></div></article>
        <article className="p-4"><div className="flex gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-emerald-100 text-emerald-700">♧</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1"><span className="rounded bg-emerald-100 px-1.5 py-1 font-mono text-[7px] font-bold text-emerald-700">DESPACHO CUADRILLA</span><span className="ml-auto text-[8px] text-slate-400">◷ Hace 1 hora</span></div><h2 className="mt-2 text-[10px] font-bold">Cuadrilla asignada a Incidencia #UTM-2384</h2><p className="mt-1 text-[9px] leading-relaxed text-slate-500">Ing. Carlos Morales ha tomado el reporte de Proyector en Aula 204. Registrado en ruta con lote de refacciones.</p><div className="mt-2 flex justify-between text-[8px] font-semibold text-teal-700"><span>♧ Soporte Audiovisual</span><span>● Técnico en Sitio</span></div></div></div></article>
      </div>
      <footer className="border-t border-slate-100 bg-[#f8f7ff] p-3"><div className="flex items-center justify-between text-[8px] font-mono"><span className="text-emerald-700">● Streaming SSE: {paused ? "Pausado" : "Conectado (Nodo B4)"}</span><button type="button" onClick={() => setPaused((value) => !value)} className="font-bold text-slate-600">{paused ? "Reanudar" : "▮▮ Pausar"}</button></div><Link href="/notificaciones" className="mt-3 block rounded bg-white px-3 py-2 text-center text-[9px] font-bold text-slate-700 shadow-sm">Ver Historial Completo de Notificaciones (/notificaciones) →</Link></footer>
    </section>
  </main>;
}
