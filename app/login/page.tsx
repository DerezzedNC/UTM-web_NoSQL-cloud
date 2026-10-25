"use client";

import { FormEvent, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";

export default function LoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = signIn(email, password);
    if (result) {
      setError(result);
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-73px)] bg-[#f7f6ff] md:grid-cols-2">
      <section className="hidden flex-col justify-end bg-slate-950 px-12 py-14 text-white md:flex">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-300">UTM Desk</p>
        <h1 className="mt-4 max-w-md text-4xl font-bold leading-tight">
          Un solo lugar para reportar y resolver lo que falla en el campus.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
          Accede a las herramientas correspondientes a tu rol operativo y da seguimiento a cada incidencia.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-700 text-xs font-bold text-white">UTM</span>
            <div><p className="text-sm font-bold text-slate-900">UTM Desk</p><p className="font-mono text-[9px] tracking-widest text-slate-400">NOSQL CLOUD OPS</p></div>
          </div>
          <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Acceso al portal</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Inicia sesión</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">Usa el correo institucional asignado a tu rol.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <label className="mt-5 block text-xs font-semibold text-slate-700">
            Correo institucional
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@utm.edu.mx" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <label className="mt-4 block text-xs font-semibold text-slate-700">
            Contraseña
            <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-normal outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <button type="submit" disabled={busy} className="mt-5 w-full rounded-lg bg-teal-800 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-wait disabled:opacity-70">
            {busy ? "Validando…" : "Iniciar sesión"}
          </button>
          <p className="mt-4 text-center text-[10px] leading-4 text-slate-400">Demo temporal: cualquier cuenta usa la contraseña <strong>utm-demo</strong>.</p>
          <p className="mt-1 text-center text-[10px] text-slate-400">Cuentas demo: admin, directiva, coordinador, tecnico y reportante (@utm.edu.mx).</p>
        </form>
      </section>
    </main>
  );
}
