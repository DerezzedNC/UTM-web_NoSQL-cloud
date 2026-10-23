import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">
            UTM Desk
          </span>
          <span className="text-sm font-medium text-slate-100">
            NoSQL Cloud · incidencias de campus
          </span>
        </Link>
        <Link
          href="/incidencias/nueva"
          className="rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        >
          Nueva incidencia
        </Link>
      </div>
    </header>
  );
}
