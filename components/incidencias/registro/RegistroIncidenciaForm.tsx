"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { CamposUbicacion } from "@/components/incidencias/registro/CamposUbicacion";
import { CamposUniversales } from "@/components/incidencias/registro/CamposUniversales";
import { DetalleAcademico } from "@/components/incidencias/registro/DetalleAcademico";
import { DetalleComputoRedes } from "@/components/incidencias/registro/DetalleComputoRedes";
import { DetalleInfraestructura } from "@/components/incidencias/registro/DetalleInfraestructura";
import { BORRADOR_INICIAL, CATEGORIA_META } from "@/lib/incidencias/constants";
import { armarPayload } from "@/lib/incidencias/payload";
import { registroIncidenciaSchema } from "@/lib/incidencias/registro-schema";
import { erroresPorCampo } from "@/lib/incidencias/schema";
import { CATEGORIAS, type BorradorIncidencia, type CategoriaIncidencia } from "@/lib/incidencias/types";

const MIME_PERMITIDOS = ["image/png", "image/jpeg", "application/pdf"];
const MAX_PESO_BYTES = 5 * 1024 * 1024;

export function RegistroIncidenciaForm() {
  const { session } = useSession();
  const canCreate = session?.role === "reportante" || session?.role === "admin";
  const [borrador, setBorrador] = useState<BorradorIncidencia>(BORRADOR_INICIAL);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (!session) return;
    setBorrador((actual) => ({
      ...actual,
      reportante: {
        id_usuario: session.id_usuario,
        nombre: session.name,
        rol: session.rol_institucional,
        correo: session.email,
      },
    }));
  }, [session]);

  function actualizar<K extends keyof BorradorIncidencia>(campo: K, valor: BorradorIncidencia[K]) {
    setBorrador((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => {
      const next = { ...actual };
      delete next[String(campo)];
      return next;
    });
    setMensaje("");
  }

  function agregarEvidencia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!MIME_PERMITIDOS.includes(file.type) || file.size > MAX_PESO_BYTES) {
      setErrores((actual) => ({
        ...actual,
        evidencias: "Solo se permiten archivos PNG, JPG o PDF de hasta 5 MB.",
      }));
      return;
    }
    const peso_kb = Number((file.size / 1024).toFixed(2));
    if (borrador.evidencias.some((item) => item.nombre_archivo === file.name)) {
      setErrores((actual) => ({
        ...actual,
        evidencias: "Ese archivo ya está adjunto en el reporte.",
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const base64Part = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
      setBorrador((actual) => ({
        ...actual,
        evidencias: [
          ...actual.evidencias,
          {
            nombre_archivo: file.name,
            tipo_mime: file.type,
            peso_kb,
            contenido_base64: base64Part,
            preview_url: dataUrl,
          },
        ],
      }));
      setErrores((actual) => {
        const next = { ...actual };
        delete next.evidencias;
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function quitarEvidencia(nombre_archivo: string) {
    actualizar(
      "evidencias",
      borrador.evidencias.filter((item) => item.nombre_archivo !== nombre_archivo),
    );
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || !session) {
      setMensaje("El registro de tickets requiere el rol Reportante o Administrador.");
      return;
    }
    const payload = armarPayload({
      ...borrador,
      reportante: {
        id_usuario: session.id_usuario,
        nombre: session.name,
        rol: session.rol_institucional,
        correo: session.email,
      },
    });
    if (!payload) {
      setMensaje("Selecciona una categoría y completa todos los datos requeridos.");
      return;
    }
    const result = registroIncidenciaSchema.safeParse(payload);
    if (!result.success) {
      setErrores(erroresPorCampo(result.error));
      setMensaje("Revisa los campos marcados antes de enviar.");
      return;
    }
    setSubiendo(true);
    try {
      const response = await fetch("/api/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": session.role },
        body: JSON.stringify(result.data),
      });
      const body = (await response.json()) as { data?: { folio: string }; error?: string };
      if (!response.ok) {
        setMensaje(body.error ?? "No se pudo crear la incidencia.");
        return;
      }
      setMensaje(`Ticket creado correctamente en MongoDB y Supabase: ${body.data?.folio ?? "sin folio"}.`);
      setBorrador({
        ...BORRADOR_INICIAL,
        reportante: {
          id_usuario: session.id_usuario,
          nombre: session.name,
          rol: session.rol_institucional,
          correo: session.email,
        },
      });
      setErrores({});
    } finally {
      setSubiendo(false);
    }
  }

  const reportante = borrador.reportante;

  return (
    <form onSubmit={enviar} className="space-y-6" noValidate>
      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md sm:p-8">
        <SectionHeading number="01" title="Datos del ticket" description="Describe la incidencia con el mayor detalle posible. La prioridad será asignada por Coordinación." />
        <div className="mt-6"><CamposUniversales value={borrador} errors={errores} onChange={actualizar} /></div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md sm:p-8">
        <SectionHeading number="02" title="Reportante y ubicación" description="Tus datos se toman automáticamente de tu sesión. Indica la ubicación del incidente." />
        <div className="mt-6 grid gap-3 rounded-2xl border border-teal-100 bg-teal-50/40 p-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Nombre</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{reportante.nombre}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Rol institucional</p>
            <p className="mt-0.5 text-sm font-medium text-slate-700">{reportante.rol}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Correo</p>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-700">{reportante.correo}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">ID de usuario</p>
            <p className="mt-0.5 font-mono text-xs text-slate-700">{reportante.id_usuario}</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><CamposUbicacion value={borrador.ubicacion} errors={errores} onChange={(value) => actualizar("ubicacion", value)} /></div>
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

      <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md sm:p-8">
        <SectionHeading number="04" title="Evidencia adjunta" description="Adjunta capturas, fotografías o documentos del incidente (PNG, JPG o PDF de hasta 5 MB)." />
        <div className="mt-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-6 text-center transition hover:border-teal-500 hover:bg-teal-50/30">
            <span className="text-sm font-semibold text-teal-800">Seleccionar archivo de evidencia</span>
            <span className="mt-1 text-xs text-slate-500">Formatos permitidos: PNG, JPG o PDF · Máximo 5 MB por archivo</span>
            <input
              disabled={!canCreate}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              onChange={agregarEvidencia}
              className="sr-only"
            />
          </label>
          {errores.evidencias ? <p className="mt-2 text-sm text-rose-700" role="alert">{errores.evidencias}</p> : null}
          {borrador.evidencias.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {borrador.evidencias.map((item) => (
                <li key={item.nombre_archivo} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xs">
                  {item.tipo_mime.startsWith("image/") && item.preview_url ? (
                    <img
                      src={item.preview_url}
                      alt={item.nombre_archivo}
                      className="mb-2.5 h-36 w-full rounded-lg border border-slate-100 bg-slate-50 object-cover"
                    />
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.nombre_archivo}</p>
                      <p className="mt-0.5 text-slate-500">{item.tipo_mime} · {item.peso_kb} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarEvidencia(item.nombre_archivo)}
                      className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Aún no has adjuntado archivos a este reporte.</p>
          )}
        </div>
      </section>

      {mensaje ? <p role="status" className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">{mensaje}</p> : null}
      <button disabled={!canCreate || subiendo} type="submit" className="w-full rounded-lg bg-[#11695c] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#0d5449] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        {subiendo ? "Subiendo evidencia y registrando..." : "Registrar incidencia"}
      </button>
    </form>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-100 font-mono text-xs font-bold text-teal-700">{number}</span><div><h2 className="text-lg font-bold tracking-tight text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div></div>;
}
