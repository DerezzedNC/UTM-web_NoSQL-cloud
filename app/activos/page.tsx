"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ASSETS, type Asset, type AssetCategory, type AssetStatus } from "@/lib/activos/mock-data";

type NoticeAction = "Exportar CSV/BSON" | "Registrar Nuevo Activo" | "Imprimir Etiquetas RFID" | "Asignar Custodio" | "Vincular a Ticket" | "Generar QR / Ficha" | "Reportar Falla" | "Editar Ficha" | "Entrada en Bitácora";

const statusLabels: Record<AssetStatus, string> = { falla: "En falla", operativo: "Operativo", preventivo: "Preventivo" };
const categoryLabels: Record<AssetCategory | "todas", string> = { todas: "Todas las categorías", switch: "Switches & Routers", computo: "Cómputo", ap: "APs", proyector: "Proyectores" };

function StatusBadge({ status }: { status: AssetStatus }) {
  const styles: Record<AssetStatus, string> = { falla: "bg-rose-50 text-rose-700", operativo: "bg-emerald-50 text-emerald-700", preventivo: "bg-indigo-50 text-indigo-700" };
  return <span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${styles[status]}`}>{statusLabels[status]}</span>;
}

function Metric({ label, value, detail, note, color, icon }: { label: string; value: string; detail: string; note: string; color: string; icon: string }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-center justify-between"><p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><span className={`grid h-6 w-6 place-items-center rounded ${color}`}>{icon}</span></div>
    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}<small className="ml-1 text-[9px] font-medium text-slate-500">{detail}</small></p>
    <div className="mt-3 h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-teal-700" style={{ width: label === "SALUD GLOBAL HARDWARE" ? "89.4%" : label === "EN FALLA / TRIAGE" ? "28%" : "95%" }} /></div>
    <p className="mt-2 text-[8px] text-slate-500">{note}</p>
  </article>;
}

export default function ActivosPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AssetCategory | "todas">("todas");
  const [status, setStatus] = useState<AssetStatus | "todos">("todos");
  const [selectedIds, setSelectedIds] = useState<string[]>([ASSETS[0].id]);
  const [notice, setNotice] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState(ASSETS[0].id);
  const selectedAsset = ASSETS.find((asset) => asset.id === selectedAssetId) ?? ASSETS[0];

  const assets = useMemo(() => {
    const normalized = query.toLocaleLowerCase("es-MX");
    return ASSETS.filter((asset) => `${asset.id} ${asset.serial} ${asset.name} ${asset.building} ${asset.room} ${asset.owner}`.toLocaleLowerCase("es-MX").includes(normalized)
      && (category === "todas" || asset.category === category)
      && (status === "todos" || asset.status === status));
  }, [category, query, status]);

  function action(label: NoticeAction) {
    setNotice(`${label}: operación registrada en la bitácora de activos (simulación frontend).`);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function toggleAsset(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds((current) => current.length === assets.length ? [] : assets.map((asset) => asset.id));
  }

  return <div className="min-h-[calc(100vh-73px)] bg-[#f8f7ff] text-slate-800">
    <div className="flex min-h-[calc(100vh-73px)]">
      <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-[#f0f1ff] px-2 py-4 md:flex md:flex-col">
        <Link href="/" className="mb-7 flex items-center gap-2 px-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-[10px] font-bold text-white">UTM</span><span><b className="block text-xs">UTM Desk</b><small className="font-mono text-[8px] tracking-widest text-slate-400">NoSQL CLOUD OPS</small></span></Link>
        <p className="px-2 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Role scope</p><span className="mt-2 block rounded bg-teal-700 px-2 py-1 text-center text-[8px] font-bold uppercase tracking-wider text-white">Infraestructura TI</span>
        <nav className="mt-4 space-y-1 text-[10px] font-semibold"><Link href="/incidencias" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">▣ &nbsp;Bandeja de Tickets</Link><Link href="/incidencias/nueva" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">⊕ &nbsp;Nueva Incidencia</Link><Link href="/activos" className="block rounded-md bg-teal-700 px-2 py-2 text-white">▥ &nbsp;Bitácora & Activos</Link><Link href="/analitica" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">▥ &nbsp;Dashboard Ejecutivo</Link><Link href="/monitoreo" className="block rounded-md px-2 py-2 text-slate-700 hover:bg-white">♧ &nbsp;Monitoreo de Red</Link></nav>
        <div className="mt-auto rounded-lg bg-white p-2 text-[8px] shadow-sm"><p className="font-mono text-slate-500">NoSQL Engine <span className="float-right text-emerald-600">Active</span></p><div className="mt-2 h-1 rounded bg-teal-600" /><p className="mt-1 text-slate-400">Write IOPS <span className="float-right">1.2k/s</span></p></div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 sm:px-7"><div><p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Sede activa</p><p className="text-xs font-bold text-slate-700">Campus Central UTM⌄</p></div><div className="flex items-center gap-2 text-[9px]"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">● Sync: Cluster-Node 04 (Real-time)</span><span className="text-slate-500">Ing. Carlos Méndez</span><span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-white">CM</span></div></header>
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[8px] text-slate-500">Infraestructura TI &gt; CMDB &amp; Gestión Hardware &gt; Catálogo de Activos (/activos)</p><h1 className="mt-1 text-xl font-bold leading-tight text-slate-900">Inventario de Activos Tecnológicos &amp; Bitácora</h1><p className="mt-1 text-[10px] text-slate-500">Gestión descentralizada de infraestructura TI universitaria con persistencia NoSQL y telemetría de red.</p></div><div className="flex gap-2"><button type="button" onClick={() => action("Exportar CSV/BSON")} className="rounded bg-white px-3 py-2 text-[9px] font-bold text-slate-700 shadow-sm">⇩ Exportar (CSV/BSON)</button><button type="button" onClick={() => action("Registrar Nuevo Activo")} className="rounded bg-teal-800 px-3 py-2 text-[9px] font-bold text-white">⊞ + Registrar Nuevo Activo</button></div></div>
          {notice ? <p className="mb-3 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-[10px] text-teal-800">{notice}</p> : null}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="TOTAL REGISTRADOS" value="1,420" detail="+24 este mes" note="Trazabilidad 98% con RFID / QR" color="bg-indigo-50 text-indigo-700" icon="▣" /><Metric label="EQUIPOS OPERATIVOS" value="1,358" detail="95.6% activo" note="SLA Meta (>95%) · Dentro de parámetro" color="bg-emerald-50 text-emerald-700" icon="✓" /><Metric label="EN FALLA / TRIAGE" value="38" detail="12 críticos" note="Tickets abiertos · 31 incidencias asignadas" color="bg-rose-50 text-rose-700" icon="△" /><Metric label="SALUD GLOBAL HARDWARE" value="89.4%" detail="MTBF 340d" note="Ciclo de recambio · 24 equipos próximos" color="bg-indigo-50 text-indigo-700" icon="◉" /></section>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="min-w-0">
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center gap-2"><label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md bg-[#f0f1ff] px-3 py-2 text-[10px] text-slate-400">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ID / Activo (ACT-UTM-0892)" className="w-full bg-transparent text-slate-700 outline-none" /></label><select value={category} onChange={(event) => setCategory(event.target.value as AssetCategory | "todas")} className="rounded-md border border-slate-200 px-2 py-2 text-[9px] text-slate-600"><option value="todas">{categoryLabels.todas}</option>{Object.entries(categoryLabels).filter(([key]) => key !== "todas").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value as AssetStatus | "todos")} className="rounded-md border border-slate-200 px-2 py-2 text-[9px] text-slate-600"><option value="todos">Todos los estados</option><option value="falla">En Falla / Mantenimiento</option><option value="operativo">Operativo</option><option value="preventivo">Preventivo</option></select><select className="rounded-md border border-slate-200 px-2 py-2 text-[9px] text-slate-600"><option>Campus Central</option><option>Campus Norte</option></select></div><p className="mt-2 text-right text-[8px] text-slate-400">Mostrando {assets.length} de 1,420 activos</p></div>
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[9px]"><thead className="bg-[#f0f1ff] font-mono text-[8px] uppercase text-slate-500"><tr><th className="w-8 px-3 py-2"><input type="checkbox" checked={assets.length > 0 && selectedIds.length === assets.length} onChange={toggleAll} aria-label="Seleccionar todos los activos" /></th><th className="px-3 py-2">ID ACTIVO</th><th className="px-3 py-2">EQUIPO / CATEGORÍA</th><th className="px-3 py-2">UBICACIÓN FÍSICA</th><th className="px-3 py-2">RESPONSABLE</th><th className="px-3 py-2">ESTADO</th></tr></thead><tbody className="divide-y divide-slate-100">{assets.map((asset) => <tr key={asset.id} onClick={() => setSelectedAssetId(asset.id)} className={`cursor-pointer transition hover:bg-teal-50 ${asset.id === selectedAssetId ? "bg-teal-50/60" : ""}`}><td className="px-3 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggleAsset(asset.id)} aria-label={`Seleccionar ${asset.id}`} /></td><td className="px-3 py-3"><b className="font-mono text-teal-700">{asset.id}</b><small className="mt-1 block text-[8px] text-slate-400">SN: {asset.serial}</small></td><td className="px-3 py-3"><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded bg-slate-100 text-teal-700">{asset.icon}</span><span className="inline-block align-middle"><b className="block max-w-[150px] text-[9px] text-slate-700">{asset.name}</b><small className="text-[8px] text-slate-400">{asset.categoryLabel}</small></span></td><td className="px-3 py-3"><b className="block text-[9px]">{asset.building}</b><small className="text-[8px] text-slate-400">{asset.room} · {asset.rack}</small></td><td className="px-3 py-3"><span className="mr-1 inline-grid h-5 w-5 place-items-center rounded-full bg-indigo-100 text-[8px] font-bold text-indigo-700">{asset.initials}</span>{asset.owner}</td><td className="px-3 py-3"><StatusBadge status={asset.status} /></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[8px] text-slate-500"><span>Filas por página: <b>10</b></span><span>‹ &nbsp; <b className="rounded bg-teal-800 px-2 py-1 text-white">1</b> &nbsp; 2 &nbsp; 3 &nbsp; ... 142 ›</span></div>{selectedIds.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f0f1ff] px-3 py-2"><span className="rounded bg-teal-800 px-2 py-1 font-mono text-[8px] font-bold text-white">{selectedIds.length} seleccionado(s)</span><span className="text-[8px] text-slate-500">Acciones masivas disponibles para inventario</span><div className="flex gap-1"><button type="button" onClick={() => action("Imprimir Etiquetas RFID")} className="rounded bg-white px-2 py-1.5 text-[8px] font-bold">▦ Imprimir Etiquetas RFID</button><button type="button" onClick={() => action("Asignar Custodio")} className="rounded bg-white px-2 py-1.5 text-[8px] font-bold">♙ Asignar Custodio</button></div></div> : null}</div>
            </section>
            <AssetDetails asset={selectedAsset} onAction={action} />
          </div>
        </div>
      </main>
    </div>
  </div>;
}

function AssetDetails({ asset, onAction }: { asset: Asset; onAction: (label: NoticeAction) => void }) {
  return <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-1"><span className="rounded bg-teal-100 px-2 py-1 font-mono text-[8px] font-bold text-teal-800">{asset.id}</span><StatusBadge status={asset.status} /></div><h2 className="mt-2 text-sm font-bold leading-tight text-slate-900">{asset.name}</h2><p className="text-[8px] text-slate-500">{asset.categoryLabel}</p></div><span className="grid h-8 w-8 place-items-center rounded bg-teal-700 text-white">{asset.icon}</span></div>
    <div className="mt-3 grid grid-cols-3 gap-1"><button type="button" onClick={() => onAction("Vincular a Ticket")} className="rounded bg-rose-50 px-1 py-2 text-[8px] font-bold text-rose-700">▣<br />Vincular a Ticket</button><button type="button" onClick={() => onAction("Generar QR / Ficha")} className="rounded bg-indigo-50 px-1 py-2 text-[8px] font-bold text-indigo-700">▦<br />Generar QR / Ficha</button><button type="button" onClick={() => onAction("Reportar Falla")} className="rounded bg-rose-50 px-1 py-2 text-[8px] font-bold text-rose-700">△<br />Reportar Falla</button></div>
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded bg-[#f0f1ff] p-3 text-[8px]"><Spec label="Dirección IP de Gestión" value={asset.ip} /><Spec label="MAC Address Base" value={asset.mac} /><Spec label="VLAN" value={asset.vlan} /><Spec label="Garantía / Soporte" value={asset.warranty} /><Spec label="Ubicación Rack Físico" value={`${asset.building} · ${asset.rack}`} /><Spec label="Último mantenimiento" value={asset.lastMaintenance} /><Spec label="Próximo mantenimiento" value={asset.nextMaintenance} /></div>
    {asset.poeTotal > 0 ? <div className="mt-3 rounded bg-amber-50 p-3"><div className="flex justify-between text-[8px] font-bold"><span>MONITOREO DE PUERTOS POE ACTIVOS</span><span className="text-rose-600">Falla en {asset.poeInUse}/{asset.poeTotal}</span></div><div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${(asset.poeInUse / asset.poeTotal) * 100}%` }} /></div><p className="mt-1 text-[8px] text-slate-500">Puertos PoE: {asset.poeInUse}/{asset.poeTotal} en uso · {asset.snmpAlert}</p></div> : null}
    <div className="mt-3"><h3 className="text-[10px] font-bold">♧ Bitácora de Soporte &amp; Eventos</h3><div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">{asset.events.map((event) => <div key={`${event.title}-${event.date}`} className="relative rounded bg-slate-50 p-2 text-[8px] before:absolute before:-left-[19px] before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-teal-600"><div className="flex justify-between gap-2 font-bold"><span>{event.title}</span><span className="whitespace-nowrap text-slate-400">{event.date}</span></div><p className="mt-1 text-slate-500">{event.detail}</p></div>)}</div></div>
    <div className="mt-3 flex gap-2"><button type="button" onClick={() => onAction("Editar Ficha")} className="flex-1 rounded border border-slate-200 px-2 py-2 text-[8px] font-bold">☷ Editar Ficha</button><button type="button" onClick={() => onAction("Entrada en Bitácora")} className="flex-1 rounded bg-teal-800 px-2 py-2 text-[8px] font-bold text-white">▣ Entrada en Bitácora</button></div>
    <div className="mt-3 rounded bg-[#f0f1ff] p-3"><div className="flex justify-between text-[9px] font-bold"><span>♧ Topología y Conexión de Enlace</span><span className="rounded bg-emerald-100 px-1 text-[8px] text-emerald-700">{asset.uplink}</span></div><p className="mt-1 text-[8px] text-slate-500">Conectado mediante fibra monomodo a Core Router Campus Central</p><p className="mt-2 font-mono text-[8px] text-slate-600">SFP+ Transceiver: 10GbE · {asset.sfpPower}</p></div>
  </aside>;
}

function Spec({ label, value }: { label: string; value: string }) {
  return <div><p className="font-mono text-[7px] uppercase text-slate-400">{label}</p><p className="mt-0.5 font-semibold text-slate-700">{value}</p></div>;
}
