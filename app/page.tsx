import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6">
      <section className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Fase 1 · Frontend
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          Gestión centralizada de incidencias del campus
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          UTM Desk NoSQL Cloud concentra el registro, el seguimiento técnico y
          la analítica de reportes operativos. Esta primera entrega cubre el
          formulario polimórfico de registro (CU-01).
        </p>
        <Link
          href="/incidencias/nueva"
          className="mt-8 inline-flex rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Registrar incidencia
        </Link>
      </section>
    </main>
  );
}
