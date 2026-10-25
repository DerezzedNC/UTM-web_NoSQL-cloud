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
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden flex-col justify-end bg-ink p-12 text-white md:flex">
        <h1 className="max-w-sm text-4xl font-semibold leading-tight">Un solo lugar para reportar y resolver lo que falla en el campus.</h1>
        <p className="mt-4 max-w-sm text-white/70">Cómputo y redes, infraestructura y servicios académicos, con seguimiento de cada ticket.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-semibold">Inicia sesión</h2>
          <Err m={err} />
          <label className="block text-sm">Correo institucional<input className={inp} type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@utm.edu.mx" /></label>
          <label className="block text-sm">Contraseña<input className={inp} type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
          <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
          <p className="text-xs text-slate-500">Modo demo: admin@, directiva@, luis.briceno@, roberto.pech@ o carlos.mendez@ (@utm.edu.mx) con cualquier contraseña.</p>
        </form>
      </section>
    </main>
  );
}
