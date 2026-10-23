"use client";

import { FormEvent, useMemo, useState } from "react";
import { CamposUniversales } from "@/components/incidencias/registro/CamposUniversales";
import { CamposUbicacion } from "@/components/incidencias/registro/CamposUbicacion";
import { DetalleAcademico } from "@/components/incidencias/registro/DetalleAcademico";
import { DetalleComputoRedes } from "@/components/incidencias/registro/DetalleComputoRedes";
import { DetalleInfraestructura } from "@/components/incidencias/registro/DetalleInfraestructura";
import { BORRADOR_INICIAL, CATEGORIA_META } from "@/lib/incidencias/constants";
import { armarPayload } from "@/lib/incidencias/payload";
import {
  camposUniversalesSchema,
  erroresPorCampo,
  incidenciaCampusSchema,
  type IncidenciaCampusPayload,
} from "@/lib/incidencias/schema";
import type { BorradorIncidencia } from "@/lib/incidencias/types";

export function RegistroIncidenciaForm() {
  const [borrador, setBorrador] = useState<BorradorIncidencia>(BORRADOR_INICIAL);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviado, setEnviado] = useState<IncidenciaCampusPayload | null>(null);

  const categoriaActiva = borrador.categoria;
  const tituloCategoria = useMemo(() => {
    if (!categoriaActiva) {
      return "Selecciona una categoría para cargar el detalle técnico.";
    }
    return CATEGORIA_META[categoriaActiva].resumen;
  }, [categoriaActiva]);

  function actualizar<K extends keyof BorradorIncidencia>(
    campo: K,
    valor: BorradorIncidencia[K],
  ) {
    setEnviado(null);
    setBorrador((actual) => ({ ...actual, [campo]: valor }));
    if (campo === "categoria") {
      setErrores((actual) => {
        const siguiente = { ...actual };
        delete siguiente.categoria;
        for (const clave of Object.keys(siguiente)) {
          if (clave.startsWith("detalle_especifico")) {
            delete siguiente[clave];
          }
        }
        return siguiente;
      });
      return;
    }
    setErrores((actual) => {
      if (!actual[String(campo)]) {
        return actual;
      }
      const siguiente = { ...actual };
      delete siguiente[String(campo)];
      return siguiente;
    });
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviado(null);

    const faltantes: Record<string, string> = {};
    if (!borrador.prioridad) {
      faltantes.prioridad = "Selecciona una prioridad.";
    }
    if (!borrador.categoria) {
      faltantes.categoria = "Selecciona una categoría.";
    }

    const payload = armarPayload(borrador);
    if (!payload) {
      const base = camposUniversalesSchema
        .pick({ titulo: true, descripcion: true, ubicacion: true })
        .safeParse({
          titulo: borrador.titulo,
          descripcion: borrador.descripcion,
          ubicacion: borrador.ubicacion,
        });
      setErrores({
        ...faltantes,
        ...(base.success ? {} : erroresPorCampo(base.error)),
      });
      return;
    }

    const resultado = incidenciaCampusSchema.safeParse(payload);
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error));
      return;
    }

    setErrores({});
    setEnviado(resultado.data);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-8" noValidate>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            CU-01
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Datos de la incidencia
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Completa el reporte operativo. Los campos técnicos cambian según la
            categoría.
          </p>
        </header>
        <CamposUniversales
          value={borrador}
          errors={errores}
          onChange={actualizar}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <header className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Ubicación</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edificio, piso y aula o laboratorio donde se presenta la incidencia.
          </p>
        </header>
        <CamposUbicacion
          value={borrador.ubicacion}
          errors={errores}
          onChange={(ubicacion) => actualizar("ubicacion", ubicacion)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <header className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Detalle específico
          </h2>
          <p className="mt-1 text-sm text-slate-500">{tituloCategoria}</p>
        </header>

        {!categoriaActiva ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Elige una categoría para mostrar el subdocumento polimórfico{" "}
            <span className="font-mono text-xs">detalle_especifico</span>.
          </p>
        ) : null}

        {categoriaActiva === "computo_redes" ? (
          <DetalleComputoRedes
            value={borrador.detalle_computo}
            errors={errores}
            onChange={(detalle_computo) =>
              actualizar("detalle_computo", detalle_computo)
            }
          />
        ) : null}

        {categoriaActiva === "infraestructura" ? (
          <DetalleInfraestructura
            value={borrador.detalle_infraestructura}
            errors={errores}
            onChange={(detalle_infraestructura) =>
              actualizar("detalle_infraestructura", detalle_infraestructura)
            }
          />
        ) : null}

        {categoriaActiva === "academico" ? (
          <DetalleAcademico
            value={borrador.detalle_academico}
            errors={errores}
            onChange={(detalle_academico) =>
              actualizar("detalle_academico", detalle_academico)
            }
          />
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            setBorrador(BORRADOR_INICIAL);
            setErrores({});
            setEnviado(null);
          }}
          className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpiar
        </button>
        <button
          type="submit"
          className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          Validar registro
        </button>
      </div>

      {enviado ? (
        <output className="block rounded-2xl border border-teal-200 bg-teal-50 p-5 text-left">
          <p className="text-sm font-semibold text-teal-900">
            Payload listo para incidencias_campus
          </p>
          <p className="mt-1 text-xs text-teal-800">
            Validación local de Fase 1. El envío a MongoDB se conectará en el
            route handler.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-teal-100">
            {JSON.stringify(enviado, null, 2)}
          </pre>
        </output>
      ) : null}
    </form>
  );
}
