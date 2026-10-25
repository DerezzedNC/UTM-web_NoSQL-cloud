"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";
import { USUARIOS_INICIALES } from "@/lib/usuarios/types";

type RootTab = "todos" | "criticos" | "cuentas" | "nodos" | "auditoria";

const tabs: { value: RootTab; label: string; count?: string }[] = [
  { value: "todos", label: "Todos", count: "28" },
  { value: "criticos", label: "Tickets Críticos", count: "3" },
  { value: "cuentas", label: "Cuentas y Accesos" },
  { value: "nodos", label: "Nodos NoSQL" },
  { value: "auditoria", label: "Auditoría" },
];

export default function Home() {
  const [tab, setTab] = useState<RootTab>("todos");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([INCIDENCIAS_INICIALES[1]?._id ?? ""]);

  const tickets = useMemo(() => {
    if (tab === "criticos") {
      return INCIDENCIAS_INICIALES.filter((ticket) => ticket.prioridad === "critica" || ticket.prioridad === "alta");
    }
    return INCIDENCIAS_INICIALES;
  }, [tab]);

  function action(label: string) {
    setNotice(`${label}: operación registrada en el ledger administrativo.`);
    window.setTimeout(() => setNotice(""), 3600);
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[#f8f7ff] text-slate-800">
      <div className="flex min-h-[calc(100vh-73px)]">
        <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-[#f0f1ff] px-2 py-4 md:flex md:flex-col">
          <Link href="/" className="mb-7 flex items-center gap-2 px-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-[10px] font-bold text-white">UTM</span><span><b className="block text-xs">UTM Desk</b><small className="font-mono text-[8px] tracking-widest text-slate-400">NoSQL CLOUD OPS</small></span></Link>
          <p className="px-2 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Role scope</p>
          <span className="mt-2 block rounded bg-teal-700 px-2 py-1 text-center text-[8px] font-bold uppercase tracking-wider text-white">Super Admin</span>
          <nav className="mt-4 space-y-1 text-[10px] font-semibold">
            <Link href="/incidencias" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">▣ &nbsp;Bandeja de Tickets</Link>
            <Link href="/incidencias/nueva" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">⊕ &nbsp;Nueva Incidencia</Link>
            <Link href="/activos" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">▥ &nbsp;Bitácora & Activos</Link>
            <Link href="/analitica" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">▥ &nbsp;Dashboard Ejecutivo</Link>
            <Link href="/monitoreo" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">♧ &nbsp;Monitoreo de Red</Link>
            <Link href="/auditoria" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">▤ &nbsp;Auditoría & Logs</Link>
            <Link href="/ajustes" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">⚙ &nbsp;Ajustes del Sistema</Link>
          </nav>
          <div className="mt-auto rounded-lg bg-white p-2 text-[8px] shadow-sm"><p className="font-mono text-slate-500">NoSQL Engine <span className="float-right text-emerald-600">Active</span></p><div className="mt-2 h-1 rounded bg-teal-600" /><p className="mt-1 text-slate-400">Write IOPS <span className="float-right">1.2k/s</span></p></div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 sm:px-7"><div><p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Sede activa</p><p className="text-xs font-bold text-slate-700">Campus Central UTM⌄</p></div><div className="flex items-center gap-2 text-[9px]"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">● Sync: Cluster-Node 04 (Real-time)</span><span className="text-slate-500">Ing. Carlos Méndez</span><span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-white">CM</span></div></header>
          <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[8px] text-slate-500">Infraestructura TI &gt; Administración Global &gt; Control Total de Plataforma (Root)</p><h1 className="mt-1 max-w-xl text-xl font-bold leading-tight text-slate-900">Consola de Administración Central y Gobernanza</h1><div className="mt-2 flex gap-2"><span className="rounded bg-teal-100 px-2 py-1 font-mono text-[8px] font-bold text-teal-800">◉ Nivel de Privilegios: Root / SuperAdmin</span><span className="rounded bg-indigo-100 px-2 py-1 font-mono text-[8px] text-indigo-700">▣ DocStore: cluster-primary_master</span></div></div><div className="flex gap-2"><button type="button" onClick={() => action("Exportar Auditoría BSON/JSON")} className="rounded bg-white px-3 py-2 text-[9px] font-bold text-slate-700 shadow-sm">⇩ Exportar Auditoría BSON/JSON</button><button type="button" onClick={() => action("Registrar Usuario / Crear Activo")} className="rounded bg-teal-800 px-3 py-2 text-[9px] font-bold text-white">♙ + Registrar Usuario / Crear Activo</button></div></div>
            {notice ? <p className="mb-3 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] text-teal-800">{notice}</p> : null}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SystemMetric label="Total Usuarios & Sesiones" value={`${USUARIOS_INICIALES.length + 44}`} detail="cuentas activas" note="4 Roles RBAC definidos" color="teal" icon="♙" />
              <SystemMetric label="Tickets Globales en Cola" value="22" detail="en despacho activo" note="3 en riesgo SLA" color="rose" icon="▣" />
              <SystemMetric label="Salud de Infraestructura" value="99.98%" detail="Uptime Cluster" note="8/8 nodos sincronizados · 1.4ms" color="emerald" icon="▦" />
              <SystemMetric label="Control de Seguridad RBAC" value="0" detail="brechas detectadas" note="1,482 accesos auditados · Firma SHA-256" color="indigo" icon="◉" />
            </section>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-3"><div><h2 className="text-xs font-bold">Matriz Global de Operaciones y Acciones de Administrador</h2><p className="mt-1 text-[8px] text-slate-500">Intervención directa de tickets, sesiones privilegiadas y gobernanza del clúster NoSQL.</p></div><button type="button" onClick={() => action("ROOT EXEC SHELL abierto")} className="rounded bg-indigo-100 px-2 py-1.5 font-mono text-[8px] font-bold text-indigo-700">▣ ROOT EXEC SHELL</button></div>
                <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-2">{tabs.map((item) => <button type="button" key={item.value} onClick={() => setTab(item.value)} className={`rounded-t px-3 py-2 text-[9px] font-semibold ${tab === item.value ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}>{item.label}{item.count ? <span className="ml-1 rounded bg-emerald-100 px-1 text-[8px] text-emerald-700">{item.count}</span> : null}</button>)}</div>
                <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[9px]"><thead className="bg-[#f0f1ff] font-mono text-[8px] uppercase text-slate-500"><tr><th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Seleccionar operaciones" /></th><th className="px-3 py-2">Operación / Identidad</th><th className="px-3 py-2">Contexto Global</th><th className="px-3 py-2">Estado de Gobernanza</th><th className="px-3 py-2">Acciones Root</th></tr></thead><tbody className="divide-y divide-slate-100">{tickets.map((ticket) => <tr key={ticket._id} className="hover:bg-teal-50"><td className="px-3 py-3"><input type="checkbox" checked={selected.includes(ticket._id)} onChange={() => toggle(ticket._id)} aria-label={`Seleccionar ${ticket.folio}`} /></td><td className="px-3 py-3"><b className="font-mono text-teal-700">{ticket.folio.replace("INC-2026-00", "#UTM-")}</b><p className="mt-1 font-semibold text-slate-700">{ticket.titulo}</p><span className="text-[8px] text-slate-400">Asignado: {ticket.tecnico_asignado?.nombre ?? "Sin asignar"}</span></td><td className="px-3 py-3 text-slate-600">{ticket.ubicacion.edificio}<br />{ticket.ubicacion.aula_laboratorio}</td><td className="px-3 py-3"><span className={`rounded px-1.5 py-1 text-[8px] font-bold ${ticket.estado === "resuelta" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{ticket.estado === "resuelta" ? "Auditado / Cerrado" : "En riesgo SLA"}</span></td><td className="px-3 py-3"><div className="flex gap-1"><button type="button" onClick={() => action("Reasignación forzosa")} className="rounded bg-indigo-100 px-2 py-1.5 text-[8px] font-semibold text-indigo-700">Reasignar Forzoso</button><button type="button" onClick={() => action("Cierre administrativo")} className="rounded bg-rose-50 px-2 py-1.5 text-[8px] font-semibold text-rose-700">Cierre Administrativo</button></div></td></tr>)}</tbody></table></div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-[#f4f5ff] px-3 py-2 font-mono text-[8px] text-slate-500"><span>Mostrando {tickets.length} operaciones clave en el sistema</span><span><button type="button" onClick={() => action(`Reasignación masiva de ${selected.length} operaciones`)} className="text-teal-700">Asignar masivo</button> · Página 1 de 7 · Siguiente ›</span></div>
              </section>
              <RootActions onAction={action} />
            </div>

            <section className="mt-4 grid gap-4 md:grid-cols-2"><article className="chart-card rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><h2 className="text-xs font-bold">Carga de Concurrencia UTM</h2><span className="rounded bg-emerald-100 px-2 py-1 text-[8px] text-emerald-700">Nominal</span></div><p className="mt-1 text-[8px] text-slate-500">Tráfico distribuido entre nodos primarios y secundarios.</p><div className="chart-bars mt-5 flex h-16 items-end gap-1">{[30, 45, 62, 82, 66, 58, 40, 52, 59, 74].map((height, index) => <span key={index} className={`chart-bar flex-1 ${index > 6 ? "bg-teal-700" : "bg-teal-200"}`} style={{ height: `${height}%` }} />)}</div><p className="mt-2 font-mono text-[8px] text-slate-500">Pool Conexiones: 240 / 1000 <span className="float-right">Avg Res: 18ms</span></p></article><article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><h2 className="text-xs font-bold">Ubicación Datacenter Principal</h2><span className="font-mono text-[8px] text-emerald-700">En línea</span></div><div className="mt-3 flex h-24 items-end justify-center rounded bg-gradient-to-b from-indigo-100 to-slate-400"><span className="rounded bg-slate-700/70 px-2 py-1 text-[8px] text-white">⌖ Campus Central · Nodo Raft Líder</span></div><p className="mt-2 font-mono text-[8px] text-slate-500">Servidor Físico: RACK-DC-01 · 192.168.18.1</p></article></section>
          </div>
        </main>
      </div>
    </div>
  );
}

function SystemMetric({ label, value, detail, note, color, icon }: { label: string; value: string; detail: string; note: string; color: "teal" | "rose" | "emerald" | "indigo"; icon: string }) {
  const palette = { teal: "text-teal-700 bg-teal-100", rose: "text-rose-600 bg-rose-100", emerald: "text-emerald-700 bg-emerald-100", indigo: "text-indigo-700 bg-indigo-100" }[color];
  return <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><p className="font-mono text-[8px] font-bold uppercase tracking-widest text-slate-500">{label}</p><span className={`grid h-6 w-6 place-items-center rounded ${palette}`}>{icon}</span></div><div className="mt-2 flex items-end gap-2"><strong className="text-2xl text-slate-900">{value}</strong><span className={`text-[8px] font-bold ${palette.split(" ")[0]}`}>{detail}</span></div><p className="mt-2 text-[8px] text-slate-500">{note}</p><div className="mt-2 h-1 rounded bg-slate-100"><div className={`h-1 rounded ${palette.split(" ")[1]}`} style={{ width: color === "rose" ? "72%" : "92%" }} /></div></article>;
}

function RootActions({ onAction }: { onAction: (label: string) => void }) {
  return <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-bold">◉ Acciones Globales Root</h2><span className="rounded bg-teal-100 px-2 py-1 font-mono text-[8px] font-bold text-teal-700">SUPER</span></div><p className="mt-2 text-[8px] text-slate-500">Controles directos de alta prioridad con impacto global sobre la red y almacenamiento NoSQL.</p><div className="mt-3 grid gap-2"><button type="button" onClick={() => onAction("Despacho & Asignación Masiva")} className="flex justify-between rounded-md bg-teal-800 px-3 py-3 text-[9px] font-bold text-white">☷ &nbsp;Despacho & Asignación Masiva <b>›</b></button><button type="button" onClick={() => onAction("Reinicio de Red PoE / Trunks")} className="flex justify-between rounded bg-indigo-100 px-3 py-2 text-[9px] font-semibold text-slate-700">↻ Reinicio de Red (PoE / Trunks) <b>›</b></button><button type="button" onClick={() => onAction("Regeneración SSL & Tokens FIDO2")} className="flex justify-between rounded bg-indigo-100 px-3 py-2 text-[9px] font-semibold text-slate-700">⚿ Regenerar SSL & Tokens FIDO2 <b>›</b></button><button type="button" onClick={() => onAction("Respaldo BSON completo preparado")} className="flex justify-between rounded bg-indigo-100 px-3 py-2 text-left text-[9px] font-semibold text-slate-700">⊞ Descargar Respaldo BSON Completo <b>⇩</b></button></div><ClusterState /></aside>;
}

function ClusterState() {
  return <div className="mt-4 border-t border-slate-100 pt-3"><div className="flex justify-between"><h3 className="text-xs font-bold">◈ Consistencia NoSQL</h3><span className="font-mono text-[8px] font-bold text-emerald-700">RAFT OK</span></div><p className="mt-1 text-[8px] text-slate-500">Topología de clúster distribuido sincronizada y gobernanza de particiones.</p><div className="mt-3 space-y-1 rounded bg-[#f4f5ff] p-2 text-[9px]"><p>● Campus Central <b className="float-right text-emerald-700">Líder Raft</b></p><p>● Campus Norte <b className="float-right text-slate-500">Follower #1</b></p><p>● Campus Sur <b className="float-right text-slate-500">Follower #2</b></p></div><p className="mt-3 font-mono text-[8px] uppercase text-slate-500">Hash de Integridad Inmutable (Ledger)</p><div className="mt-1 rounded bg-[#f4f5ff] p-2 font-mono text-[8px] break-all">sha256:f8a98b1e9828f7b053482e1aa4921c8b893ae0e2f6919c4d9f72a11bc48</div><p className="mt-2 rounded bg-emerald-50 p-2 text-[8px] font-semibold text-emerald-700">▣ Modo Root Activo<br /><span className="font-normal">Todos los módulos del sistema desbloqueados</span></p></div>;
}
