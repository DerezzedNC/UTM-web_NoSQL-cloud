"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { CATEGORIA_META, PRIORIDAD_META, TECNICOS_DISPONIBLES } from "@/lib/incidencias/constants";
import { canCloseTicket, hasPermission } from "@/lib/rbac";
import { PRIORIDADES, type EstadoIncidencia, type IncidenciaCampus, type Prioridad } from "@/lib/incidencias/types";

const estadosTecnico: EstadoIncidencia[] = ["en proceso", "en espera", "resuelta"];
const estadosCoordinador: EstadoIncidencia[] = ["abierta", "en proceso", "en espera", "resuelta", "cerrada"];
const stateStyle: Record<EstadoIncidencia, string> = {
  abierta: "bg-teal-50 text-teal-700",
  "en proceso": "bg-emerald-50 text-emerald-700",
  "en espera": "bg-amber-50 text-amber-700",
  resuelta: "bg-emerald-50 text-emerald-700",
  cerrada: "bg-slate-100 text-slate-600",
};
const selectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function IncidenciaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = useSession();
  const [ticket, setTicket] = useState<IncidenciaCampus>();
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<EstadoIncidencia>("en proceso");
  const [horas, setHoras] = useState("0");
  const [comentario, setComentario] = useState("");
  const [tag, setTag] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [idTecnico, setIdTecnico] = useState("");
  const [riesgoSeguridad, setRiesgoSeguridad] = useState("Medio");
  const [notice, setNotice] = useState("");

  const canTriage = Boolean(session && hasPermission(session.role, "incidencia:triage"));
  const canUpdate = Boolean(session && hasPermission(session.role, "incidencia:update"));
  const canManageTags = Boolean(session && hasPermission(session.role, "incidencia:tags"));
  const isTecnico = session?.role === "tecnico";
  const isCoordinador = session?.role === "coordinador";

  useEffect(() => {
    params.then(async ({ id }) => {
      try {
        const res = await fetch(`/api/incidencias/${id}`);
        if (res.ok) {
          const body = (await res.json()) as { data: IncidenciaCampus };
          setTicket(body.data);
          setPrioridad(body.data.prioridad);
          setIdTecnico(body.data.tecnico_asignado?.id_usuario ?? "");
          if ("riesgo_seguridad" in body.data.detalle_especifico) {
            setRiesgoSeguridad(body.data.detalle_especifico.riesgo_seguridad);
          }
          setEstado(body.data.estado === "abierta" ? "en proceso" : body.data.estado);
        }
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const tieneAccesoAlTicket = useMemo(() => {
    if (!session || !ticket) return false;
    if (session.role === "admin" || session.role === "coordinador" || session.role === "directiva") {
      return true;
    }
    if (session.role === "reportante") {
      return (
        ticket.reportante.id_usuario === session.id_usuario ||
        ticket.reportante.correo.toLowerCase() === session.email.toLowerCase()
      );
    }
    if (session.role === "tecnico") {
      return Boolean(
        ticket.tecnico_asignado &&
          (ticket.tecnico_asignado.id_usuario === session.id_usuario ||
            ticket.tecnico_asignado.correo.toLowerCase() === session.email.toLowerCase()),
      );
    }
    return false;
  }, [session, ticket]);

  const detailRows = useMemo(() => {
    if (!ticket) return [];
    const detail = ticket.detalle_especifico;
    if ("direccion_ip" in detail)
      return [
        ["Dirección IP", detail.direccion_ip],
        ["VLAN", detail.vlan],
        ["Puerto uplink", detail.puerto_uplink],
        ["Equipos afectados", detail.equipos_afectados],
      ];
    if ("tipo_dano" in detail)
      return [
        ["Tipo de daño", detail.tipo_dano],
        ["Riesgo de seguridad", detail.riesgo_seguridad],
        ["Requiere insumos", detail.requiere_insumos ? "Sí" : "No"],
        ["Contratista externo", detail.contratista_externo ? "Sí" : "No"],
      ];
    return [
      ["Plataforma", detail.plataforma],
      ["Código de curso", detail.codigo_curso],
      ["Periodo escolar", detail.periodo_escolar],
      ["Estudiantes impactados", detail.estudiantes_impactados],
    ];
  }, [ticket]);

  async function submitTriage(event: FormEvent) {
    event.preventDefault();
    if (!canTriage || !ticket || !session) return;
    const response = await fetch(`/api/incidencias/${ticket._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-role": session.role },
      body: JSON.stringify({
        prioridad,
        id_tecnico: idTecnico,
        riesgo_seguridad: "riesgo_seguridad" in ticket.detalle_especifico ? riesgoSeguridad : undefined,
        autor: session.name,
      }),
    });
    const body = (await response.json()) as { data?: IncidenciaCampus; error?: string };
    if (!response.ok || !body.data) return setNotice(body.error ?? "No se pudo guardar la asignación.");
    setTicket(body.data);
    setNotice("Prioridad y asignación actualizadas correctamente.");
  }

  async function submitStatus(event: FormEvent) {
    event.preventDefault();
    if (!canUpdate || !session) return setNotice("Esta función requiere el rol Técnico, Coordinador o Administrador.");
    const horasNum = isCoordinador ? 0 : Number(horas);
    if (!ticket || !comentario.trim() || horasNum < 0) return setNotice("Completa el comentario y horas válidas.");
    const response = await fetch(`/api/incidencias/${ticket._id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-role": session.role },
      body: JSON.stringify({
        estado_nuevo: estado,
        horas_sumadas: horasNum,
        comentario,
        autor: session.name,
      }),
    });
    const body = (await response.json()) as { data?: IncidenciaCampus; error?: string };
    if (!response.ok || !body.data) return setNotice(body.error ?? "No se pudo actualizar.");
    setTicket(body.data);
    setComentario("");
    setHoras("0");
    setNotice("Estado y bitácora actualizados.");
  }

  async function updateTag(action: "add" | "remove", value: string) {
    if (!canManageTags) return setNotice("Solo el Coordinador o Administrador pueden gestionar etiquetas.");
    if (!ticket || !value.trim()) return;
    const response = await fetch(`/api/incidencias/${ticket._id}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-role": session?.role ?? "" },
      body: JSON.stringify({ action, tag: value.trim() }),
    });
    const body = (await response.json()) as { data?: string[]; error?: string };
    if (!response.ok || !body.data) return setNotice(body.error ?? "No se pudieron actualizar las etiquetas.");
    setTicket({ ...ticket, tags: body.data });
    setTag("");
    setNotice("Etiquetas actualizadas.");
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-slate-600">Cargando expediente...</main>;
  if (!ticket) return <main className="min-h-screen bg-slate-50 p-8 text-slate-600">No se encontró la incidencia.</main>;

  if (!tieneAccesoAlTicket) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Acceso restringido</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">No tienes permiso para ver este expediente</h1>
          <p className="mt-2 text-sm text-slate-600">
            {session?.role === "reportante"
              ? "Como reportante solo puedes consultar las incidencias que tú registraste."
              : "Como técnico solo puedes consultar y atender las incidencias que te fueron asignadas por Coordinación."}
          </p>
          <Link href="/incidencias" className="mt-6 inline-block rounded-lg bg-[#11695c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d5449]">
            Volver a mis incidencias
          </Link>
        </div>
      </main>
    );
  }

  const availableStates = isTecnico
    ? estadosTecnico
    : estadosCoordinador.filter((item) => item !== "cerrada" || Boolean(session && canCloseTicket(session.role)));

  return (
    <main className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50/80 via-slate-50 to-teal-50/40 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/incidencias" className="font-semibold text-teal-700">
          ← Incidencias
        </Link>
        <header className="mt-5 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-600">{ticket.folio}</span>
            <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${stateStyle[ticket.estado]}`}>{ticket.estado}</span>
            <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold">
              Prioridad: {PRIORIDAD_META[ticket.prioridad].etiqueta}
            </span>
            <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              {CATEGORIA_META[ticket.categoria].etiqueta}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">{ticket.titulo}</h1>
              <p className="mt-2 max-w-3xl text-slate-600">{ticket.descripcion}</p>
              <p className="mt-3 font-mono text-xs text-slate-500">
                Creada: {ticket.fecha_creacion}
                {ticket.fecha_resolucion ? ` · Resuelta: ${ticket.fecha_resolucion}` : ""}
              </p>
            </div>
            <div className="rounded-2xl bg-teal-50 px-5 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600">Horas invertidas</p>
              <p className="mt-1 text-2xl font-bold text-teal-800">{ticket.horas_invertidas}</p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="grid gap-4 sm:grid-cols-3">
              <InfoCard title="Reportante">
                <p className="font-semibold text-slate-900">{ticket.reportante.nombre}</p>
                <p>{ticket.reportante.rol}</p>
                <p className="truncate font-mono text-xs">{ticket.reportante.correo}</p>
                <p className="font-mono text-xs">{ticket.reportante.id_usuario}</p>
              </InfoCard>
              <InfoCard title="Ubicación">
                <p className="font-semibold text-slate-900">{ticket.ubicacion.edificio}</p>
                <p>
                  {ticket.ubicacion.piso} · {ticket.ubicacion.aula_laboratorio}
                </p>
              </InfoCard>
              <InfoCard title="Técnico asignado">
                {ticket.tecnico_asignado ? (
                  <>
                    <p className="font-semibold text-slate-900">{ticket.tecnico_asignado.nombre}</p>
                    <p className="text-xs text-teal-700">{CATEGORIA_META[ticket.tecnico_asignado.area].etiqueta}</p>
                    <p className="truncate font-mono text-xs">{ticket.tecnico_asignado.correo}</p>
                  </>
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
                    Sin asignar · Pendiente de Coordinación
                  </p>
                )}
              </InfoCard>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Detalle específico · {CATEGORIA_META[ticket.categoria].etiqueta}
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {detailRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Bitácora de seguimiento</h2>
              <div className="mt-5 space-y-5 border-l-2 border-teal-100 pl-5">
                {ticket.historial_seguimiento.map((item, idx) => (
                  <div key={`${item.fecha}-${item.autor}-${idx}`} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-teal-500 ring-4 ring-teal-50" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{item.fecha}</span>
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${stateStyle[item.estado_nuevo]}`}>
                        {item.estado_nuevo}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {item.autor}
                        {item.horas_sumadas > 0 ? ` · +${item.horas_sumadas} h` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.comentario}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            {canTriage ? (
              <OperationCard title="Coordinación · Prioridad y asignación">
                <form onSubmit={submitTriage} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="prioridad-select">
                      Prioridad de la incidencia
                    </label>
                    <select
                      id="prioridad-select"
                      value={prioridad}
                      onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                      className={selectClass}
                    >
                      {PRIORIDADES.map((item) => (
                        <option key={item} value={item}>
                          {PRIORIDAD_META[item].etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>

                  {"riesgo_seguridad" in ticket.detalle_especifico ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="riesgo-select">
                        Riesgo de seguridad
                      </label>
                      <select
                        id="riesgo-select"
                        value={riesgoSeguridad}
                        onChange={(e) => setRiesgoSeguridad(e.target.value)}
                        className={selectClass}
                      >
                        <option value="Bajo">Bajo</option>
                        <option value="Medio">Medio</option>
                        <option value="Alto">Alto</option>
                        <option value="Crítico">Crítico</option>
                      </select>
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="tecnico-select">
                      Asignar a técnico / ingeniero
                    </label>
                    <select
                      id="tecnico-select"
                      value={idTecnico}
                      onChange={(e) => setIdTecnico(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— Sin asignar —</option>
                      {TECNICOS_DISPONIBLES.map((tec) => (
                        <option key={tec.id_usuario} value={tec.id_usuario}>
                          {tec.nombre} ({CATEGORIA_META[tec.area].etiqueta})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button className="w-full rounded-lg bg-[#11695c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d5449]">
                    Guardar clasificación y asignar
                  </button>
                </form>
              </OperationCard>
            ) : null}

            {canUpdate ? (
              <OperationCard title={isCoordinador ? "Validación y estado" : "Atención técnica · Actualizar estado"}>
                <form onSubmit={submitStatus} className="mt-4 space-y-3">
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Responsable en sesión: <strong className="text-slate-900">{session?.name}</strong>
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="estado-nuevo">
                      Nuevo estado
                    </label>
                    <select
                      id="estado-nuevo"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value as EstadoIncidencia)}
                      className={selectClass}
                    >
                      {availableStates.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!isCoordinador ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="horas-input">
                        Horas trabajadas a sumar
                      </label>
                      <input
                        id="horas-input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={horas}
                        onChange={(e) => setHoras(e.target.value)}
                        placeholder="Horas"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </div>
                  ) : null}
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder={
                      isCoordinador
                        ? "Comentario de coordinación o validación de cierre..."
                        : "Describe las acciones realizadas o el diagnóstico técnico..."
                    }
                    className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                  <button className="w-full rounded-lg bg-[#11695c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d5449]">
                    Guardar seguimiento
                  </button>
                </form>
              </OperationCard>
            ) : null}

            <OperationCard title="Etiquetas">
              <div className="mt-4 flex flex-wrap gap-2">
                {ticket.tags.length > 0 ? (
                  ticket.tags.map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      #{item}
                      {canManageTags ? (
                        <button
                          type="button"
                          onClick={() => updateTag("remove", item)}
                          className="ml-2 font-bold text-slate-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Sin etiquetas asignadas por Coordinación.</p>
                )}
              </div>
              {canManageTags ? (
                <div className="mt-4 flex gap-2">
                  <input
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="Nueva etiqueta"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => updateTag("add", tag)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Agregar
                  </button>
                </div>
              ) : null}
            </OperationCard>

            <OperationCard title="Evidencia adjunta en el reporte">
              {ticket.evidencias_adjuntas.length > 0 ? (
                <ul className="mt-4 space-y-3 text-xs">
                  {ticket.evidencias_adjuntas.map((item) => (
                    <li key={item.url_storage} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {item.tipo_mime.startsWith("image/") && item.url_firmada ? (
                        <a
                          href={item.url_firmada}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2.5 block overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <img
                            src={item.url_firmada}
                            alt={item.nombre_archivo}
                            className="max-h-56 w-full object-contain transition hover:scale-[1.02]"
                          />
                        </a>
                      ) : null}
                      <p className="font-semibold text-slate-900">{item.nombre_archivo}</p>
                      <p className="mt-0.5 text-slate-500">
                        {item.tipo_mime} · {item.peso_kb} KB
                      </p>
                      {item.url_firmada ? (
                        <a
                          href={item.url_firmada}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 font-semibold text-teal-800 hover:bg-teal-100"
                        >
                          {item.tipo_mime === "application/pdf" ? "Abrir documento PDF ↗" : "Ver imagen completa ↗"}
                        </a>
                      ) : (
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{item.url_storage}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  El reportante no adjuntó archivos al momento de registrar esta incidencia.
                </p>
              )}
            </OperationCard>
          </aside>
        </div>

        {notice ? (
          <p role="status" className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">
            {notice}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="mt-3 space-y-1 text-sm text-slate-600">{children}</div>
    </section>
  );
}

function OperationCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
