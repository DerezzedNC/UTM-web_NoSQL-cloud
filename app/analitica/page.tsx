"use client";

import Link from "next/link";
import { useState } from "react";
import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";

const failures = [
  ["Redes y Conectividad (VLAN / Switches)", 44, "bg-teal-700"],
  ["Hardware Multimedia y Proyección AV", 28, "bg-indigo-400"],
  ["Servicios Cloud & Portales Académicos", 18, "bg-sky-400"],
  ["Laboratorios de Cómputo Especializado", 10, "bg-slate-400"],
];

export default function AnaliticaPage() {
  const [notice, setNotice] = useState("");
  const resolved = INCIDENCIAS_INICIALES.filter((ticket) => ticket.estado === "resuelta").length;
  const csat = Math.min(99, 92 + resolved);

  function exportReport() {
    const report = JSON.stringify({ generatedAt: new Date().toISOString(), scope: "directiva", tickets: INCIDENCIAS_INICIALES }, null, 2);
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "informe-gerencial-utm.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Informe gerencial exportado correctamente.");
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[#f8f7ff] text-slate-800">
      <div className="flex min-h-[calc(100vh-73px)]">
        <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-[#f0f1ff] px-2 py-4 md:flex md:flex-col">
          <Link href="/" className="mb-7 flex items-center gap-2 px-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-[10px] font-bold text-white">UTM</span><span><b className="block text-xs">UTM Desk</b><small className="font-mono text-[8px] tracking-widest text-slate-400">NoSQL CLOUD OPS</small></span></Link>
          <p className="px-2 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Role scope</p>
          <span className="mt-2 block rounded bg-emerald-100 px-2 py-1 text-center text-[8px] font-bold uppercase tracking-wider text-emerald-700">Directiva</span>
          <nav className="mt-4 space-y-1 text-[10px] font-semibold"><Link href="/analitica" className="block rounded-md bg-teal-700 px-2 py-2.5 text-white">▥ &nbsp;Dashboard Ejecutivo</Link><Link href="/incidencias" className="block rounded-md px-2 py-2.5 text-slate-700 hover:bg-white">▣ &nbsp;Bandeja de Tickets<br /><span className="ml-4 text-[8px] font-normal">(Supervisión)</span></Link></nav>
          <div className="mt-auto rounded-lg bg-white p-2 text-[8px] shadow-sm"><p className="font-mono text-slate-500">NoSQL Engine <span className="float-right text-emerald-600">Active</span></p><div className="mt-2 h-1 rounded bg-teal-600" /><p className="mt-1 text-slate-400">Write IOPS <span className="float-right">1.2k/s</span></p></div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 sm:px-7"><div><p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Sede activa</p><p className="text-xs font-bold text-slate-700">Campus Central UTM⌄</p></div><div className="flex items-center gap-2 text-[9px]"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">● Sync: Cluster-Node 04 (Real-time)</span><span className="text-slate-500">Dra. Beatriz Arizmendi</span><span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-white">BA</span></div></header>
          <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[8px] text-slate-500">Infraestructura &gt; Dirección de TI &gt; Dashboard Ejecutivo & Auditoría SLA</p><h1 className="mt-1 max-w-xl text-xl font-bold leading-tight text-slate-900">Consola Directiva - Indicadores Estratégicos & Supervisión Institucional</h1></div><div className="flex gap-2"><span className="rounded bg-emerald-50 px-2 py-2 font-mono text-[8px] text-emerald-700">Modo Lectura<br />Supervisión</span><span className="rounded bg-indigo-50 px-2 py-2 font-mono text-[8px] text-indigo-700">⚙ DocStore: audit_signed_master</span><button type="button" onClick={exportReport} className="rounded bg-indigo-100 px-3 py-2 text-[9px] font-bold text-indigo-800">⇩ Exportar Informe<br />Gerencial (PDF/JSON)</button><button type="button" onClick={() => setNotice("Auditoría de cumplimiento abierta en modo lectura.")} className="rounded bg-teal-800 px-3 py-2 text-[9px] font-bold text-white">▣ Auditoría de<br />Cumplimiento</button></div></div>
            {notice ? <p className="mb-3 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] text-teal-800">{notice}</p> : null}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Cumplimiento Global SLA" value="96.8%" delta="+1.8% vs Q3" detail="Meta institucional: 95.0%" color="teal" icon="◉" />
              <Kpi label="MTTR Institucional" value="38 min" delta="-12 min YoY" detail="Tiempo medio de resolución" color="indigo" icon="◴" />
              <Kpi label="Índice CSAT Docente" value={`${(csat / 20).toFixed(1)}/5.0`} delta="Excelente (96%)" detail="Muestra: 486 encuestas" color="blue" icon="☺" />
              <Kpi label="Tickets Atendidos Mes" value="1,482" delta="+9.2%" detail="Resueltos / mes activo" color="emerald" icon="✓" />
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_1fr_1.1fr]">
              <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><h2 className="text-xs font-bold">Distribución de Fallas por Tipo</h2><span className="rounded bg-indigo-50 px-2 py-1 text-[8px] text-indigo-700">Mes Actual</span></div><div className="mt-8 space-y-3">{failures.map(([label, value, color]) => <div key={label as string}><div className="flex justify-between font-mono text-[8px]"><span>{label}</span><b>{value}%</b></div><div className="mt-1 h-1.5 rounded bg-slate-100"><div className={`h-1.5 rounded ${color}`} style={{ width: `${value}%` }} /></div></div>)}</div></article>
              <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><h2 className="text-xs font-bold">Cumplimiento SLA por Facultad</h2><span className="font-mono text-[8px] text-emerald-700">Todas las sedes</span></div><div className="mt-7 space-y-2">{[["Facultad de Ingeniería & Ciencias", "98.2%", "488 tickets resueltos"], ["Ciencias de la Salud & Medicina", "97.5%", "312 tickets resueltos"], ["Administración & Humanidades", "95.4%", "284 tickets resueltos"]].map(([label, score, detail]) => <div key={label} className="rounded bg-[#f4f5ff] p-2"><div className="flex justify-between text-[9px] font-bold"><span>{label}</span><b className="text-teal-700">{score}</b></div><p className="mt-1 text-[8px] text-slate-500">{detail}</p><div className="mt-1 h-1 rounded bg-slate-200"><div className="h-1 rounded bg-teal-600" style={{ width: score }} /></div></div>)}</div></article>
              <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><h2 className="text-xs font-bold">Estado del Clúster<br />DocStore NoSQL</h2><span className="rounded bg-emerald-100 px-2 py-1 text-[8px] font-bold text-emerald-700">100% Sincronizado</span></div><div className="mt-5 grid grid-cols-2 gap-2">{[["Nodos Activos", "08 / 08"], ["Latencia Sync", "1.4 ms"], ["Hash Auditoría", "sha256:49f2..."], ["Uptime Trimestral", "99.98%"]].map(([label, value]) => <div key={label} className="rounded bg-[#f4f5ff] p-2"><span className="block font-mono text-[8px] text-slate-500">{label}</span><b className="mt-1 block font-mono text-sm text-teal-800">{value}</b></div>)}</div><button type="button" onClick={() => setNotice("Certificado criptográfico verificado: integridad confirmada.")} className="mt-2 w-full rounded bg-indigo-50 px-2 py-2 text-[9px] font-semibold text-slate-700">◉ Verificar Certificado Criptográfico</button></article>
            </section>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-3"><div><h2 className="text-xs font-bold">Supervisión de Incidencias Críticas Recientes</h2><p className="mt-1 font-mono text-[8px] text-slate-500">Solo Lectura / Consola Directiva</p></div><span className="rounded bg-emerald-100 px-2 py-1 font-mono text-[8px] text-emerald-700">◉ Auditoría inmutable</span></div><div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left text-[9px]"><thead className="bg-[#f0f1ff] font-mono text-[8px] uppercase text-slate-500"><tr><th className="px-3 py-2">Ticket ID</th><th className="px-3 py-2">Incidencia estratégica</th><th className="px-3 py-2">Ubicación campus</th><th className="px-3 py-2">Técnico / Cuadrilla</th><th className="px-3 py-2">Cumplimiento SLA</th><th className="px-3 py-2">Auditoría</th></tr></thead><tbody className="divide-y divide-slate-100">{INCIDENCIAS_INICIALES.map((ticket) => <tr key={ticket._id}><td className="px-3 py-3 font-mono text-teal-700">{ticket.folio.replace("INC-2026-00", "#UTM-")}<span className="mt-1 block text-[8px] text-rose-600">{ticket.prioridad.toUpperCase()}</span></td><td className="max-w-[190px] px-3 py-3"><b>{ticket.titulo}</b><span className="mt-1 block text-[8px] text-slate-400">{ticket.tags.join(" · ")}</span></td><td className="px-3 py-3 text-slate-600">{ticket.ubicacion.edificio}<br />{ticket.ubicacion.aula_laboratorio}</td><td className="px-3 py-3 text-slate-600">{ticket.tecnico_asignado?.nombre ?? "Sin asignar"}</td><td className="px-3 py-3"><span className={`rounded px-1.5 py-1 text-[8px] font-bold ${ticket.estado === "resuelta" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{ticket.estado === "resuelta" ? "Cumplido 100%" : "En Riesgo"}</span></td><td className="px-3 py-3"><button type="button" onClick={() => setNotice(`Ficha de auditoría ${ticket.folio} consultada.`)} className="rounded bg-indigo-100 px-2 py-1 text-[8px] text-indigo-700">Ver Ficha</button></td></tr>)}</tbody></table></div><p className="border-t border-slate-100 bg-[#f4f5ff] px-3 py-2 font-mono text-[8px] text-slate-500">Visualización directiva consolidada · {INCIDENCIAS_INICIALES.length} de 28 incidencias · 🔒 Acceso Directivo de Solo Lectura</p></section>
              <AuditPanel onAction={setNotice} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, detail, color, icon }: { label: string; value: string; delta: string; detail: string; color: "teal" | "indigo" | "blue" | "emerald"; icon: string }) {
  const colors = { teal: "text-teal-700 bg-teal-100", indigo: "text-indigo-700 bg-indigo-100", blue: "text-blue-700 bg-blue-100", emerald: "text-emerald-700 bg-emerald-100" };
  return <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><p className="font-mono text-[8px] font-bold uppercase tracking-widest text-slate-500">{label}</p><span className={`grid h-6 w-6 place-items-center rounded ${colors[color]}`}>{icon}</span></div><div className="mt-2 flex items-end justify-between"><strong className="text-2xl text-slate-900">{value}</strong><span className={`text-[8px] font-bold ${colors[color].split(" ")[0]}`}>✓ {delta}</span></div><p className="mt-2 text-[8px] text-slate-500">{detail}</p><div className="mt-2 h-1 rounded bg-slate-100"><div className={`h-1 rounded ${colors[color].split(" ")[1].replace("bg-", "bg-")}`} style={{ width: "88%" }} /></div></article>;
}

function AuditPanel({ onAction }: { onAction: (message: string) => void }) {
  return <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><span className="rounded bg-emerald-100 px-2 py-1 font-mono text-[8px] font-bold text-emerald-700">AUDITORÍA REGULATORIA</span><span className="text-teal-700">◉</span></div><h2 className="mt-2 text-xs font-bold">Gobernanza & Clúster NoSQL</h2><p className="mt-4 font-mono text-[8px] uppercase text-slate-500">Salud de sincronización campus</p><div className="mt-2 space-y-1 rounded bg-[#f4f5ff] p-2 font-mono text-[8px]"><p>Campus Central UTM <b className="float-right text-emerald-700">Activo / Conectado</b></p><p>Campus Norte <b className="float-right text-emerald-700">Activo / Conectado</b></p><p>Campus Sur <b className="float-right text-emerald-700">Activo / Conectado</b></p></div><p className="mt-3 font-mono text-[8px] uppercase text-slate-500">Verificación hash de registro</p><div className="mt-2 rounded bg-[#f4f5ff] p-2 font-mono text-[8px]">e7b8b943d2e185f67a2940c</div><p className="mt-2 text-[8px] font-semibold text-emerald-700">◉ Integridad inmutable validada</p><div className="mt-4 grid gap-2"><button type="button" onClick={() => onAction("Acta de cierre SLA preparada para descarga.")} className="rounded-md bg-teal-800 px-3 py-2 text-[9px] font-bold text-white">▣ Descargar Acta de Cierre SLA</button><button type="button" onClick={() => onAction("Registro de auditoría general abierto en modo lectura.")} className="rounded-md bg-indigo-100 px-3 py-2 text-[9px] font-semibold text-slate-700">◉ Registro de Auditoría General</button></div></aside>;
}
