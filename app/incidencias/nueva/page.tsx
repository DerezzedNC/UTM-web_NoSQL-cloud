import Link from "next/link";
import { RegistroIncidenciaForm } from "@/components/incidencias/registro/RegistroIncidenciaForm";

export default function NuevaIncidenciaPage() {
  return (
    <main className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50/80 via-slate-50 to-teal-50/40 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/incidencias" className="text-sm font-semibold text-teal-700">← Incidencias</Link>
        <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Centro de atención</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Reportar incidencia</h1><p className="mt-1 text-slate-500">Completa los datos del reporte.</p></div>
        <div className="mt-6"><RegistroIncidenciaForm /></div>
      </div>
    </main>
  );
}
