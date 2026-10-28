"use client";

import { FormEvent, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { CamposUbicacion } from "@/components/incidencias/registro/CamposUbicacion";
import { CamposUniversales } from "@/components/incidencias/registro/CamposUniversales";
import { DetalleAcademico } from "@/components/incidencias/registro/DetalleAcademico";
import { DetalleComputoRedes } from "@/components/incidencias/registro/DetalleComputoRedes";
import { DetalleInfraestructura } from "@/components/incidencias/registro/DetalleInfraestructura";
import { Field, inputClass } from "@/components/ui/Field";
import { BORRADOR_INICIAL, CATEGORIA_META } from "@/lib/incidencias/constants";
import { armarPayload } from "@/lib/incidencias/payload";
import { erroresPorCampo, incidenciaCampusSchema } from "@/lib/incidencias/schema";
import { CATEGORIAS, type BorradorIncidencia, type CategoriaIncidencia } from "@/lib/incidencias/types";

export function RegistroIncidenciaForm() {
  const { session } = useSession();
  const canCreate = session?.role === "reportante" || session?.role === "admin";
  const [borrador, setBorrador] = useState<BorradorIncidencia>(BORRADOR_INICIAL);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState("");

  function actualizar<K extends keyof BorradorIncidencia>(campo: K, valor: BorradorIncidencia[K]) {
    setBorrador((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => {
      const next = { ...actual };
      delete next[String(campo)];
      return next;
    });
    setMensaje("");
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setMensaje("El registro de tickets requiere el rol Reportante o Administrador.");
      return;
    }
    const payload = armarPayload(borrador);
    if (!payload) {
      setMensaje("Completa la prioridad, categoría y todos los datos requeridos.");
      return;
    }
    const result = incidenciaCampusSchema.safeParse(payload);
    if (!result.success) {
      setErrores(erroresPorCampo(result.error));
      setMensaje("Revisa los campos marcados antes de enviar.");
      return;
    }
    const response = await fetch("/api/incidencias", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-role": "reportante" },
      body: JSON.stringify(result.data),
    });
    const body = await response.json() as { data?: { folio: string }; error?: string };
    if (!response.ok) {
      setMensaje(body.error ?? "No se pudo crear la incidencia.");
      return;
    }
    setMensaje(`Ticket creado correctamente: ${body.data?.folio ?? "sin folio"}.`);
    setBorrador(BORRADOR_INICIAL);
    setErrores({});
  }

  const reportante = borrador.reportante;

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate>
      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md sm:p-8">
        <SectionHeading number="01" title="Datos del ticket" description="Describe la incidencia y elige su prioridad." />
        <div className="mt-6"><CamposUniversales value={borrador} errors={errores} onChange={actualizar} /></div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md sm:p-8">
        <SectionHeading number="02" title="Reportante y ubicación" description="Indica quién reporta y dónde ocurre." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field id="id_usuario" label="ID de usuario" error={errores["reportante.id_usuario"]}><input id="id_usuario" value={reportante.id_usuario} onChange={(e) => actualizar("reportante", { ...reportante, id_usuario: e.target.value })} className={inputClass(Boolean(errores["reportante.id_usuario"]))} /></Field>
          <Field id="nombre" label="Nombre completo" error={errores["reportante.nombre"]}><input id="nombre" value={reportante.nombre} onChange={(e) => actualizar("reportante", { ...reportante, nombre: e.target.value })} className={inputClass(Boolean(errores["reportante.nombre"]))} /></Field>
          <Field id="correo" label="Correo institucional" error={errores["reportante.correo"]}><input id="correo" type="email" value={reportante.correo} onChange={(e) => actualizar("reportante", { ...reportante, correo: e.target.value })} className={inputClass(Boolean(errores["reportante.correo"]))} /></Field>
          <Field id="rol" label="Rol" error={errores["reportante.rol"]}><select id="rol" value={reportante.rol} onChange={(e) => actualizar("reportante", { ...reportante, rol: e.target.value as BorradorIncidencia["reportante"]["rol"] })} className={inputClass(Boolean(errores["reportante.rol"]))}><option>Docente</option><option>Estudiante</option><option>Administrativo</option></select></Field>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><CamposUbicacion value={borrador.ubicacion} errors={errores} onChange={(value) => actualizar("ubicacion", value)} /></div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md sm:p-8">
        <SectionHeading number="03" title="Categoría y detalle" description="Selecciona una categoría y completa sus datos." />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {CATEGORIAS.map((categoria) => (
            <label key={categoria} className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${borrador.categoria === categoria ? "border-teal-400 bg-teal-50 shadow-md shadow-teal-500/10" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"}`}>
              <input disabled={!canCreate} type="radio" name="categoria" value={categoria} checked={borrador.categoria === categoria} onChange={() => actualizar("categoria", categoria as CategoriaIncidencia)} className="sr-only" />
              <span className="text-sm font-bold text-slate-900">{CATEGORIA_META[categoria].etiqueta}</span>
              <span className="mt-1 block text-xs text-slate-600">{CATEGORIA_META[categoria].resumen}</span>
            </label>
          ))}
        </div>
        {errores.categoria ? <p className="mt-2 text-sm text-rose-700">{errores.categoria}</p> : null}
        <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/30 p-5">
          <p className="font-mono text-xs font-bold text-teal-700">Detalle específico {borrador.categoria ? `· ${borrador.categoria}` : ""}</p>
          <div className="mt-4">{borrador.categoria === "computo_redes" ? <DetalleComputoRedes value={borrador.detalle_computo} errors={errores} onChange={(value) => actualizar("detalle_computo", value)} /> : null}{borrador.categoria === "infraestructura" ? <DetalleInfraestructura value={borrador.detalle_infraestructura} errors={errores} onChange={(value) => actualizar("detalle_infraestructura", value)} /> : null}{borrador.categoria === "academico" ? <DetalleAcademico value={borrador.detalle_academico} errors={errores} onChange={(value) => actualizar("detalle_academico", value)} /> : null}{!borrador.categoria ? <p className="text-sm text-slate-500">Selecciona una categoría para mostrar sus campos exclusivos.</p> : null}</div>
        </div>
      </section>

      {mensaje ? <p role="status" className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">{mensaje}</p> : null}
      <button disabled={!canCreate} type="submit" className="w-full rounded-lg bg-[#11695c] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#0d5449] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">Registrar incidencia</button>
    </form>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-100 font-mono text-xs font-bold text-teal-700">{number}</span><div><h2 className="text-lg font-bold tracking-tight text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div></div>;
}
