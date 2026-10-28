'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { inp, btn, Err } from '@/components/ui';

export default function Login() {
  const r = useRouter();
  const [correo, setCorreo] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function enviar(e) {
    e.preventDefault(); setErr('');
    if (!/^.+@utm\.edu\.mx$/.test(correo)) return setErr('Usa tu correo institucional (@utm.edu.mx).');
    setBusy(true);
    try { const { token, usuario } = await api.login(correo, pw); localStorage.setItem('token', token); localStorage.setItem('usuario', JSON.stringify(usuario)); r.replace('/incidencias'); }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <main className="min-h-screen bg-paper md:grid md:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white md:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full border border-white/10" />
        <div className="relative flex w-full flex-col">
          <div className="mb-auto">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-lg font-bold shadow-lg shadow-teal/20">U</span>
              <div>
                <p className="text-lg font-semibold tracking-tight">UTM Desk</p>
                <p className="text-xs text-white/60">Gestión de incidencias</p>
              </div>
            </div>
          </div>
          <div className="pb-5">
            <div className="mb-6 h-1 w-12 rounded-full bg-teal" />
            <h1 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Un solo lugar para reportar y resolver lo que falla en el campus.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/75">Cómputo y redes, infraestructura y servicios académicos, con seguimiento claro de cada ticket.</p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3 border-t border-white/10 pt-5">
              <div><p className="text-lg font-semibold">01</p><p className="mt-1 text-xs text-white/60">Reporta</p></div>
              <div><p className="text-lg font-semibold">02</p><p className="mt-1 text-xs text-white/60">Da seguimiento</p></div>
              <div><p className="text-lg font-semibold">03</p><p className="mt-1 text-xs text-white/60">Resuelve</p></div>
            </div>
          </div>
        </div>
      </section>
      <section className="flex min-h-screen flex-col items-center justify-center px-6 py-10 md:px-12">
        <div className="mb-8 flex items-center gap-3 md:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-lg font-bold text-white">U</span>
          <div>
            <p className="text-left text-lg font-semibold tracking-tight text-slate-900">UTM Desk</p>
            <p className="text-left text-xs text-slate-500">Gestión de incidencias</p>
          </div>
        </div>
        <form onSubmit={enviar} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-teal">Acceso seguro</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Inicia sesión</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Ingresa con tu correo institucional para continuar.</p>
          </div>
          <Err m={err} />
          <label className="block text-sm font-medium text-slate-700">Correo institucional<input className={inp} type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@utm.edu.mx" /></label>
          <label className="block text-sm font-medium text-slate-700">Contraseña<input className={inp} type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs leading-5 text-slate-500">Modo demo: usa un correo institucional autorizado con cualquier contraseña.</p>
          </div>
        </form>
      </section>
    </main>
  );
}
