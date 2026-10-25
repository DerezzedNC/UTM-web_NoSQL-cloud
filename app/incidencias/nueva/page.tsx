"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useRef, useState } from "react";
import { registroIncidenciaSchema, type RegistroIncidenciaPayload } from "@/lib/incidencias/registro-schema";
import { createDemoIncidencia } from "@/lib/incidencias/demo-store";
import type { Prioridad } from "@/lib/incidencias/types";
import { Can, RBACProvider } from "@/components/auth/Can";

type Category = "redes" | "computo" | "audiovisual" | "energia" | "software";
type Evidence = { file: File; preview: string };

const categories: { value: Category; label: string; detail: string; icon: string }[] = [
  { value: "redes", label: "Redes & Wi-Fi", detail: "AP / DNS", icon: "⌁" },
  { value: "computo", label: "Cómputo & PC", detail: "Workstations / OS", icon: "▣" },
  { value: "audiovisual", label: "Audiovisual", detail: "Proyectores / Audio", icon: "▱" },
  { value: "energia", label: "Energía / UPS", detail: "Sobretensión / Batería", icon: "ϟ" },
  { value: "software", label: "Software UTM", detail: "SIA / Licencias Lab", icon: "▦" },
];

const priorities: { value: Prioridad; label: string; detail: string; sla: string }[] = [
  { value: "baja", label: "Baja", detail: "Mantenimiento no interrumpe", sla: "48 horas" },
  { value: "media", label: "Media", detail: "Incidencia parcial afecta aula", sla: "4 horas" },
  { value: "alta", label: "Alta", detail: "Clase en curso / docente", sla: "45 min" },
  { value: "critica", label: "Crítica", detail: "Paro total / campus", sla: "15 min" },
];

const initial = {
  campus: "Campus Central",
  edificio: "Ingeniería en Sistemas",
  aula: "Lab Cómputo B-204",
  category: "" as Category | "",
  asset: "",
  title: "",
  description: "",
  priority: "" as Prioridad | "",
};

export default function NuevaIncidenciaPage() {
  const [form, setForm] = useState(initial);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function addFiles(files: FileList | File[]) {
    const accepted = Array.from(files).filter((file) =>
      ["image/png", "image/jpeg", "application/pdf"].includes(file.type) && file.size <= 5 * 1024 * 1024,
    );
    if (accepted.length !== files.length) {
      setNotice("Solo se aceptan PNG, JPG o PDF de máximo 5 MB.");
    }
    setEvidence((current) => [
      ...current,
      ...accepted.map((file) => ({
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      })),
    ]);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function buildPayload(): RegistroIncidenciaPayload | null {
    if (!form.category || !form.priority) return null;
    const base = {
      titulo: form.title,
      descripcion: form.description,
      tags: [form.category, form.asset || "sin-activo"],
      prioridad: form.priority,
      ubicacion: { edificio: form.edificio, piso: "PB", aula_laboratorio: form.aula },
      reportante: {
        id_usuario: "u-carlos-mendez",
        nombre: "Carlos Méndez",
        tipo: "Docente" as const,
        correo: "carlos.mendez@utm.mx",
      },
    };
    if (form.category === "redes" || form.category === "computo") {
      return {
        ...base,
        categoria: "computo_redes",
        detalle_especifico: {
          direccion_ip: "No especificada",
          vlan: 1,
          puerto_uplink: form.asset || "No especificado",
          equipos_afectados: 1,
        },
      };
    }
    if (form.category === "software") {
      return {
        ...base,
        categoria: "academico",
        detalle_especifico: {
          plataforma: "Servicios UTM",
          codigo_curso: "GENERAL",
          periodo_escolar: "Actual",
          estudiantes_impactados: 1,
        },
      };
    }
    return {
      ...base,
      categoria: "infraestructura",
      detalle_especifico: {
        tipo_dano: form.category === "energia" ? "Energía / UPS" : "Audiovisual",
        riesgo_seguridad: form.priority === "critica" ? "Alto" : "Medio",
        requiere_insumos: false,
        insumos_solicitados: [],
        contratista_externo: false,
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      setNotice("Selecciona una categoría y una prioridad antes de enviar.");
      return;
    }
    const result = registroIncidenciaSchema.safeParse(payload);
    if (!result.success) {
      setNotice("Completa el título y la descripción con información válida.");
      return;
    }
    const created = createDemoIncidencia(result.data);
    setSuccess(`#UTM-${created.folio.slice(-4)}`);
  }

  return (
    <RBACProvider role="reportante">
    <div className="min-h-screen bg-[#f7f6ff] text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-[10px] font-bold text-white">UTM</span>
            <span><b className="block text-xs">UTM Desk</b><small className="font-mono text-[8px] tracking-widest text-slate-400">NoSQL CLOUD OPS</small></span>
          </Link>
          <div className="hidden items-center gap-3 text-[10px] sm:flex">
            <span><b className="block uppercase tracking-widest text-slate-400">Sede activa</b><strong>Campus Central UTM⌄</strong></span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">● Sync: Cluster Node 04 (Real-time)</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-800 text-white">CM</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1380px]">
        <aside className="hidden w-40 shrink-0 border-r border-slate-200 bg-[#f1f2ff] px-2 py-5 md:block">
          <p className="px-2 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Role scope</p>
          <span className="mt-2 block rounded bg-teal-700 px-2 py-1 text-center text-[8px] font-bold uppercase tracking-wider text-white">Reportante</span>
          <nav className="mt-4 space-y-1 text-[10px] font-semibold">
            <Link href="/mis-incidencias" className="block rounded-md px-2 py-2.5 text-slate-700 hover:bg-white">▣ &nbsp;Mis Incidencias</Link>
            <span className="block rounded-md bg-teal-700 px-2 py-2.5 text-white">⊕ &nbsp;Nueva Incidencia</span>
            <Link href="/incidencias" className="block rounded-md px-2 py-2.5 text-slate-700 hover:bg-white">▣ &nbsp;Bandeja de Tickets</Link>
          </nav>
          <div className="mt-[calc(100vh-390px)] rounded-lg bg-white p-2 text-[8px] shadow-sm"><p className="font-mono text-slate-500">NoSQL Engine <span className="float-right text-emerald-600">Active</span></p><div className="mt-2 h-1 rounded bg-teal-600" /><p className="mt-1 text-slate-400">Write IOPS <span className="float-right">1.2k/s</span></p></div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-teal-700">Portal de Mesa de Ayuda UTM</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Registrar Nueva Incidencia</h1><p className="mt-1 text-[10px] text-slate-500">Generación de incidencias críticas para personal docente, laboratorios y unidades académicas.</p></div>
            <span className="rounded bg-indigo-50 px-2 py-1 text-[9px] font-mono text-indigo-700">DIS-IT Ops</span>
          </div>
          {notice ? <p className="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{notice}</p> : null}

          <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_285px]">
            <div className="space-y-3">
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Step number="01" title="Ubicación y Entorno Físico" required />
                <div className="mt-3 grid gap-2 sm:grid-cols-3"><Select label="Campus Universitario" value={form.campus} options={["Campus Central", "Campus Huajuapan", "Campus Tehuantepec"]} onChange={(value) => update("campus", value)} /><Select label="Facultad / Edificio" value={form.edificio} options={["Ingeniería en Sistemas", "Edificio A - Rectoría", "Ciencias e Ingenierías"]} onChange={(value) => update("edificio", value)} /><Select label="Aula / Laboratorio" value={form.aula} options={["Lab Cómputo B-204", "Aula B-203", "Laboratorio de Redes"]} onChange={(value) => update("aula", value)} /></div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Step number="02" title="Categoría de la Incidencia" />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{categories.map((item) => <label key={item.value} className={`cursor-pointer rounded-md border p-2.5 text-center transition ${form.category === item.value ? "border-teal-700 bg-teal-700 text-white shadow-md" : "border-slate-200 bg-[#f4f5ff] hover:border-teal-300"}`}><input type="radio" name="category" className="sr-only" checked={form.category === item.value} onChange={() => update("category", item.value)} /><span className="block text-lg">{item.icon}</span><b className="mt-1 block text-[9px]">{item.label}</b><span className={`mt-1 block text-[8px] ${form.category === item.value ? "text-teal-100" : "text-slate-500"}`}>{item.detail}</span></label>)}</div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Step number="03" title="Detalle de Falla y Activo Institucional" />
                <div className="mt-3 space-y-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">⚙ Vincular Activo Institucional <span className="float-right font-mono font-normal text-teal-700">Ver inventario de lab ↗</span><div className="mt-1 flex gap-2"><input value={form.asset} onChange={(event) => update("asset", event.target.value)} placeholder="UTM-AP-CISCO-8820" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-normal normal-case outline-none focus:border-teal-500" /><span className="rounded-md bg-emerald-50 px-2 py-2 text-[9px] font-bold text-emerald-700">✓ Validado</span></div></label>
                  <Input label="Título Resumido del Incidente" value={form.title} onChange={(value) => update("title", value)} placeholder="Caída de conectividad SSID Eduroam" />
                  <label className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">Descripción Detallada y Pasos para Reproducir <span className="float-right font-normal normal-case text-slate-400">Markdown habilitado</span><textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} placeholder="Describe qué ocurrió, desde cuándo y quiénes están afectados." className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-xs font-normal normal-case outline-none focus:border-teal-500" /></label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Step number="04" title="Ponderación de Urgencia & SLA Asignado" /><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{priorities.map((item) => <label key={item.value} className={`cursor-pointer rounded-md border p-2.5 ${form.priority === item.value ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-[#f4f5ff]"}`}><input type="radio" name="priority" className="sr-only" checked={form.priority === item.value} onChange={() => update("priority", item.value)} /><b className="block text-[10px]">{item.label}</b><span className={`mt-1 block text-[8px] ${form.priority === item.value ? "text-teal-100" : "text-slate-500"}`}>{item.detail}</span><strong className="mt-2 block font-mono text-[9px]">{item.sla} respuesta</strong></label>)}</div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Step number="05" title="Evidencias Fotográficas & Capturas" optional />
                <div onDrop={drop} onDragOver={(event) => event.preventDefault()} onClick={() => inputRef.current?.click()} className="mt-3 cursor-pointer rounded-md border border-dashed border-indigo-200 bg-[#f0f1ff] px-4 py-7 text-center"><span className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-teal-100 text-lg text-teal-700">☁</span><p className="mt-2 text-[10px] font-semibold text-slate-700">Arrastre capturas de pantalla o fotos del equipo aquí</p><p className="mt-1 text-[8px] text-slate-500">o haga clic para explorar archivos · PNG, JPG, PDF (Hasta 5MB)</p><input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} /></div>
                {evidence.length > 0 ? <div className="mt-2 grid grid-cols-4 gap-2">{evidence.map((item, index) => <div key={`${item.file.name}-${index}`} className="relative h-14 overflow-hidden rounded border border-slate-200 bg-slate-100">{item.preview ? <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[9px] font-bold text-slate-500">PDF</span>}<button type="button" onClick={() => setEvidence((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded bg-white/90 px-1 text-[9px] text-rose-600">×</button></div>)}</div> : null}
              </section>

              <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setForm(initial); setEvidence([]); setNotice("Borrador guardado localmente."); }} className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-700">▣ &nbsp;Guardar Borrador</button><Can do="ticket:create"><button type="submit" className="rounded-md bg-teal-700 px-5 py-2.5 text-[10px] font-bold text-white shadow-sm hover:bg-teal-800">▷ &nbsp;Enviar Reporte y Notificar Cuadrilla</button></Can></div>
            </div>

            <aside className="space-y-3">
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between"><h2 className="text-xs font-bold">◷ Acuerdos de Nivel de Servicio (SLA)</h2><span className="font-mono text-[8px] text-teal-700">ISO/IEC<br />20000</span></div><p className="mt-2 text-[9px] text-slate-500">El tiempo de atención y resolución está regulado por el protocolo de soporte técnico universitario centralizado.</p>{[["Severidad Crítica", "15 min", "bg-rose-50 text-rose-700"], ["Severidad Alta (Activa)", "45 min", "bg-teal-50 text-teal-700"], ["Severidad Media", "4 horas", "bg-slate-50 text-slate-700"]].map(([label, time, tone]) => <div key={label} className={`mt-2 rounded-md p-2 ${tone}`}><div className="flex justify-between text-[9px] font-bold"><span>● {label}</span><span>{time}</span></div><p className="mt-1 text-[8px] opacity-80">Respuesta operativa conforme al protocolo.</p></div>)}</section>
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex justify-between"><h2 className="text-xs font-bold">⌕ Base de Conocimiento Rápida</h2><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">IA Triage</span></div><p className="mt-1 text-[9px] text-slate-500">Artículos relevantes sugeridos según los términos detectados.</p>{["Reiniciar sesión Eduroam tras cambio de credenciales SIA", "Restablecer Gateway IP de laboratorio por consola", "Habilitar reserva provisional de Wi-Fi de emergencia"].map((item) => <div key={item} className="mt-2 rounded bg-[#f4f5ff] p-2 text-[9px] text-slate-600">{item}<span className="float-right">↗</span></div>)}</section>
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><h2 className="text-xs font-bold text-slate-800">◉ Línea de Emergencia UTM</h2><p className="mt-1 text-[9px] text-slate-500">Atención telefónica de cuadrilla en campus</p><div className="mt-2 rounded bg-teal-50 p-2"><span className="block text-[8px] text-slate-500">Conmutador Interno Directo</span><strong className="font-mono text-lg text-teal-800">EXT. 4400 / 4401</strong><a href="tel:4400" className="float-right rounded bg-teal-700 px-2 py-1 text-[9px] font-bold text-white">☎ Marcar</a></div><p className="mt-2 text-[8px] text-slate-600">◉ Operador de turno en cabina: Técnico Ramón Velázquez (Campus Central)</p></section>
            </aside>
          </form>
        </main>
      </div>
      {success ? <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/30 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div><h2 className="mt-3 text-lg font-bold text-slate-900">Incidencia registrada</h2><p className="mt-1 text-xs text-slate-500">Folio generado:</p><p className="mt-3 font-mono text-xl font-bold text-teal-800">{success}</p><button onClick={() => { setSuccess(""); setForm(initial); setEvidence([]); }} className="mt-5 rounded-lg bg-teal-800 px-5 py-2.5 text-xs font-bold text-white">Continuar</button></div></div> : null}
    </div>
    </RBACProvider>
  );
}

function Step({ number, title, required, optional }: { number: string; title: string; required?: boolean; optional?: boolean }) {
  return <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs font-bold text-slate-800"><span className="grid h-5 w-5 place-items-center rounded bg-indigo-50 font-mono text-[9px] text-indigo-700">{number}</span>{title}</h2><span className="text-[8px] font-mono uppercase tracking-widest text-slate-400">{required ? "Obligatorio" : optional ? "Opcional" : ""}</span></div>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-normal normal-case outline-none focus:border-teal-500" /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] font-normal normal-case text-slate-700 outline-none focus:border-teal-500">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
