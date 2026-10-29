import { Int32, ObjectId, type Document, type Filter } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getAnioFolio, getNextFolio } from "@/lib/redis";
import {
  generarUrlFirmada,
  hasSupabaseConfigured,
  subirArchivoEvidencia,
} from "@/lib/supabase";
import { PRIORIDAD_META, TECNICOS_DISPONIBLES } from "./constants";
import { INCIDENCIAS_INICIALES } from "./mock-data";
import type { RegistroIncidenciaPayload } from "./registro-schema";
import {
  PRIORIDADES,
  type CategoriaIncidencia,
  type EstadoIncidencia,
  type EvidenciaAdjunta,
  type HistorialSeguimiento,
  type IncidenciaCampus,
  type Prioridad,
  type RolReportante,
  type TecnicoAsignado,
} from "./types";

const COLLECTION = "incidencias_campus";

function hasMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0);
}

function toDbEstado(estado: EstadoIncidencia): string {
  if (estado === "en proceso") return "en_proceso";
  if (estado === "en espera") return "en_espera";
  return estado;
}

function fromDbEstado(estado: string): EstadoIncidencia {
  if (estado === "en_proceso") return "en proceso";
  if (estado === "en_espera") return "en espera";
  if (
    estado === "abierta" ||
    estado === "en proceso" ||
    estado === "en espera" ||
    estado === "resuelta" ||
    estado === "cerrada"
  ) {
    return estado;
  }
  return "abierta";
}

function toDbRiesgo(riesgo: string): "Bajo" | "Medio" | "Alto" | "Critico" {
  if (riesgo === "Crítico" || riesgo === "Critico") return "Critico";
  if (riesgo === "Bajo" || riesgo === "Medio" || riesgo === "Alto") return riesgo;
  return "Medio";
}

function fromDbRiesgo(riesgo: string): string {
  if (riesgo === "Critico") return "Crítico";
  return riesgo || "Medio";
}

function toIsoOrString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

export function mapMongoDocToIncidencia(doc: Document): IncidenciaCampus {
  const rawDetalle = (doc.detalle_especifico ?? {}) as Record<string, unknown>;
  const categoria = (doc.categoria ?? "computo_redes") as CategoriaIncidencia;

  const detalle_especifico: IncidenciaCampus["detalle_especifico"] =
    categoria === "computo_redes"
      ? {
          direccion_ip: String(rawDetalle.direccion_ip ?? ""),
          vlan: Number(rawDetalle.vlan ?? 1),
          puerto_uplink: String(rawDetalle.puerto_uplink ?? ""),
          equipos_afectados: Number(rawDetalle.equipos_afectados ?? 1),
        }
      : categoria === "infraestructura"
        ? {
            tipo_dano: String(rawDetalle.tipo_dano ?? ""),
            riesgo_seguridad: fromDbRiesgo(String(rawDetalle.riesgo_seguridad ?? "Medio")),
            requiere_insumos: Boolean(rawDetalle.requiere_insumos),
            contratista_externo: Boolean(rawDetalle.contratista_externo),
          }
        : {
            plataforma: String(rawDetalle.plataforma ?? ""),
            codigo_curso: String(rawDetalle.codigo_curso ?? ""),
            periodo_escolar: String(rawDetalle.periodo_escolar ?? ""),
            estudiantes_impactados: Number(rawDetalle.estudiantes_impactados ?? 1),
          };

  const rawReportante = (doc.reportante ?? {}) as Record<string, unknown>;
  const rolInstitucional = (rawReportante.rol_institucional ?? rawReportante.rol ?? "Docente") as RolReportante;
  const reportante = {
    id_usuario: String(rawReportante.id_usuario ?? ""),
    nombre: String(rawReportante.nombre ?? ""),
    rol_institucional: rolInstitucional,
    rol: rolInstitucional,
    correo: String(rawReportante.correo ?? ""),
  };

  const rawTecnico = doc.tecnico_asignado as Record<string, unknown> | undefined;
  const tecnico_asignado: TecnicoAsignado | undefined = rawTecnico
    ? {
        id_usuario: String(rawTecnico.id_usuario ?? ""),
        nombre: String(rawTecnico.nombre ?? ""),
        correo: String(rawTecnico.correo ?? ""),
        area: (rawTecnico.area ?? categoria) as CategoriaIncidencia,
      }
    : undefined;

  const rawHistorial = Array.isArray(doc.historial_seguimiento) ? doc.historial_seguimiento : [];
  const historial_seguimiento: HistorialSeguimiento[] = rawHistorial
    .map((item: Record<string, unknown>) => ({
      fecha: toIsoOrString(item.fecha),
      autor: String(item.autor ?? ""),
      estado_nuevo: fromDbEstado(String(item.estado_nuevo ?? "abierta")),
      horas_sumadas: Number(item.horas_sumadas ?? 0),
      comentario: String(item.comentario ?? ""),
    }))
    .reverse();

  const rawEvidencias = Array.isArray(doc.evidencias_adjuntas) ? doc.evidencias_adjuntas : [];
  const evidencias_adjuntas: EvidenciaAdjunta[] = rawEvidencias.map((item: Record<string, unknown>) => ({
    nombre_archivo: String(item.nombre_archivo ?? ""),
    tipo_mime: String(item.tipo_mime ?? "image/png"),
    peso_kb: Number(item.peso_kb ?? 0),
    url_storage: String(item.storage_key ?? item.url_storage ?? ""),
    fecha_carga: toIsoOrString(item.fecha_carga),
    ...(typeof item.url_firmada === "string" ? { url_firmada: item.url_firmada } : {}),
  }));

  return {
    _id: String(doc._id),
    folio: String(doc.folio ?? ""),
    titulo: String(doc.titulo ?? ""),
    descripcion: String(doc.descripcion ?? ""),
    prioridad: (doc.prioridad ?? "media") as Prioridad,
    categoria,
    estado: fromDbEstado(String(doc.estado ?? "abierta")),
    horas_invertidas: Number(doc.horas_invertidas ?? 0),
    fecha_creacion: toIsoOrString(doc.fecha_creacion),
    ...(doc.fecha_resolucion ? { fecha_resolucion: toIsoOrString(doc.fecha_resolucion) } : {}),
    reportante,
    ...(tecnico_asignado ? { tecnico_asignado } : {}),
    ubicacion: {
      edificio: String(doc.ubicacion?.edificio ?? ""),
      piso: String(doc.ubicacion?.piso ?? ""),
      aula_laboratorio: String(doc.ubicacion?.aula_laboratorio ?? ""),
    },
    detalle_especifico,
    tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
    historial_seguimiento,
    evidencias_adjuntas,
  };
}

async function enriquecerEvidenciasConUrlFirmada(
  incidencia: IncidenciaCampus,
): Promise<IncidenciaCampus> {
  if (!hasSupabaseConfigured() || incidencia.evidencias_adjuntas.length === 0) {
    return incidencia;
  }
  const evidenciasConUrl = await Promise.all(
    incidencia.evidencias_adjuntas.map(async (ev) => ({
      ...ev,
      url_firmada: ev.url_firmada ?? (await generarUrlFirmada(ev.storage_key || ev.url_storage || "")),
    })),
  );
  return {
    ...incidencia,
    evidencias_adjuntas: evidenciasConUrl,
  };
}

function buildIdFilter(id: string): Filter<Document> {
  if (ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { folio: id }] };
  }
  return { $or: [{ _id: id as unknown as ObjectId }, { folio: id }] };
}

export async function listarIncidenciasDb(params: {
  q?: string;
  categoria?: string;
  estado?: string;
  edificio?: string;
  rol?: string;
  id_usuario?: string;
  correo?: string;
}): Promise<IncidenciaCampus[]> {
  const q = (params.q ?? "").trim();
  const categoria = (params.categoria ?? "").trim();
  const estado = (params.estado ?? "").trim();
  const edificio = (params.edificio ?? "").trim();
  const rol = (params.rol ?? "").trim();
  const idUsuario = (params.id_usuario ?? "").trim();
  const correo = (params.correo ?? "").trim();

  if (hasMongoConfigured()) {
    try {
      const db = await getDb();
      const col = db.collection(COLLECTION);

      const conditions: Filter<Document>[] = [];

      if (rol === "reportante" && (idUsuario || correo)) {
        const orReportante: Filter<Document>[] = [];
        if (idUsuario) orReportante.push({ "reportante.id_usuario": idUsuario });
        if (correo) orReportante.push({ "reportante.correo": { $regex: `^${correo}$`, $options: "i" } });
        conditions.push({ $or: orReportante });
      }

      if (rol === "tecnico" && (idUsuario || correo)) {
        const orTecnico: Filter<Document>[] = [];
        if (idUsuario) orTecnico.push({ "tecnico_asignado.id_usuario": idUsuario });
        if (correo) orTecnico.push({ "tecnico_asignado.correo": { $regex: `^${correo}$`, $options: "i" } });
        conditions.push({ $or: orTecnico });
      }

      if (categoria) {
        conditions.push({ categoria });
      }

      if (estado) {
        conditions.push({ estado: toDbEstado(estado as EstadoIncidencia) });
      }

      if (edificio) {
        conditions.push({ "ubicacion.edificio": { $regex: edificio, $options: "i" } });
      }

      if (q) {
        conditions.push({
          $or: [
            { titulo: { $regex: q, $options: "i" } },
            { descripcion: { $regex: q, $options: "i" } },
            { folio: { $regex: q, $options: "i" } },
          ],
        });
      }

      const query: Filter<Document> = conditions.length > 0 ? { $and: conditions } : {};
      const docs = await col.find(query).sort({ fecha_creacion: -1 }).toArray();
      return docs.map(mapMongoDocToIncidencia);
    } catch (err) {
      console.warn(
        "[db] No se pudo consultar MongoDB Atlas en listarIncidenciasDb, usando datos locales de respaldo:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const normalizar = (v: string) => v.trim().toLocaleLowerCase("es-MX");
  const qNorm = normalizar(q);
  const edifNorm = normalizar(edificio);
  const idNorm = normalizar(idUsuario);
  const correoNorm = normalizar(correo);

  return INCIDENCIAS_INICIALES.filter((incidencia) => {
    if (rol === "reportante") {
      const esSuya =
        normalizar(incidencia.reportante.id_usuario) === idNorm ||
        normalizar(incidencia.reportante.correo) === correoNorm;
      if (!esSuya) return false;
    }
    if (rol === "tecnico") {
      const asignadaAEl =
        incidencia.tecnico_asignado &&
        (normalizar(incidencia.tecnico_asignado.id_usuario) === idNorm ||
          normalizar(incidencia.tecnico_asignado.correo) === correoNorm);
      if (!asignadaAEl) return false;
    }
    const matchQ =
      !qNorm ||
      normalizar(incidencia.titulo).includes(qNorm) ||
      normalizar(incidencia.descripcion).includes(qNorm) ||
      normalizar(incidencia.folio).includes(qNorm);
    const matchCat = !categoria || incidencia.categoria === categoria;
    const matchEst = !estado || incidencia.estado === estado;
    const matchEdif = !edifNorm || normalizar(incidencia.ubicacion.edificio).includes(edifNorm);
    return matchQ && matchCat && matchEst && matchEdif;
  });
}

export async function obtenerIncidenciaDb(id: string): Promise<IncidenciaCampus | null> {
  if (hasMongoConfigured()) {
    try {
      const db = await getDb();
      const doc = await db.collection(COLLECTION).findOne(buildIdFilter(id));
      if (doc) {
        const mapped = mapMongoDocToIncidencia(doc);
        return enriquecerEvidenciasConUrlFirmada(mapped);
      }
    } catch (err) {
      console.warn(
        "[db] No se pudo consultar MongoDB Atlas en obtenerIncidenciaDb, usando respaldo local:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  const local = INCIDENCIAS_INICIALES.find((item) => item._id === id || item.folio === id) ?? null;
  return local ? enriquecerEvidenciasConUrlFirmada(local) : null;
}

export async function crearIncidenciaDb(payload: RegistroIncidenciaPayload): Promise<IncidenciaCampus> {
  const now = new Date();
  const anio = getAnioFolio(now);

  if (hasMongoConfigured()) {
    try {
      const db = await getDb();
      const col = db.collection(COLLECTION);

      let folio: string;
      try {
        const next = await getNextFolio(anio);
        folio = next.folio;
      } catch {
        const count = await col.countDocuments();
        folio = `INC-${anio}-${String(count + 1).padStart(4, "0")}`;
      }

      const evidenciasSubidas = await Promise.all(
        (payload.evidencias ?? []).map(async (item) => {
          let storageKey = `evidencias-utm/${anio}/${payload.categoria}/${folio}/${item.nombre_archivo}`;
          let pesoKb = item.peso_kb;

          if (hasSupabaseConfigured() && item.contenido_base64) {
            const archivoBuffer = Buffer.from(item.contenido_base64, "base64");
            const uploaded = await subirArchivoEvidencia({
              archivoBuffer,
              nombreArchivo: item.nombre_archivo,
              tipoMime: item.tipo_mime,
              categoria: payload.categoria,
              folio,
            });
            storageKey = uploaded.storageKey;
            pesoKb = uploaded.pesoKb;
          }

          return {
            nombre_archivo: item.nombre_archivo,
            tipo_mime: item.tipo_mime,
            peso_kb: pesoKb,
            storage_key: storageKey,
            fecha_carga: now,
          };
        }),
      );

      const detalleBson =
        payload.categoria === "computo_redes"
          ? {
              direccion_ip: payload.detalle_especifico.direccion_ip,
              vlan: new Int32(Math.max(1, Math.min(4094, Math.trunc(payload.detalle_especifico.vlan)))),
              puerto_uplink: payload.detalle_especifico.puerto_uplink,
              equipos_afectados: new Int32(Math.max(1, Math.trunc(payload.detalle_especifico.equipos_afectados || 1))),
            }
          : payload.categoria === "infraestructura"
            ? {
                tipo_dano: payload.detalle_especifico.tipo_dano,
                riesgo_seguridad: toDbRiesgo(payload.detalle_especifico.riesgo_seguridad),
                requiere_insumos: Boolean(payload.detalle_especifico.requiere_insumos),
                contratista_externo: Boolean(payload.detalle_especifico.contratista_externo),
              }
            : {
                plataforma: payload.detalle_especifico.plataforma,
                codigo_curso: payload.detalle_especifico.codigo_curso,
                periodo_escolar: payload.detalle_especifico.periodo_escolar,
                estudiantes_impactados: new Int32(Math.max(1, Math.trunc(payload.detalle_especifico.estudiantes_impactados || 1))),
              };

      const docToInsert: Document = {
        folio,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        categoria: payload.categoria,
        prioridad: payload.prioridad ?? "media",
        estado: "abierta",
        horas_invertidas: 0,
        fecha_creacion: now,
        reportante: {
          id_usuario: payload.reportante.id_usuario,
          nombre: payload.reportante.nombre,
          rol_institucional: payload.reportante.rol,
          correo: payload.reportante.correo,
        },
        ubicacion: payload.ubicacion,
        detalle_especifico: detalleBson,
        tags: payload.tags ?? [],
        historial_seguimiento: [
          {
            fecha: now,
            autor: payload.reportante.nombre,
            estado_nuevo: "abierta",
            horas_sumadas: 0,
            comentario: "Incidencia creada por el reportante. Pendiente de clasificación y asignación por Coordinación.",
          },
        ],
        evidencias_adjuntas: evidenciasSubidas,
      };

      const result = await col.insertOne(docToInsert);
      const mapped = mapMongoDocToIncidencia({ ...docToInsert, _id: result.insertedId });
      return enriquecerEvidenciasConUrlFirmada(mapped);
    } catch (err) {
      console.warn(
        "[db] No se pudo insertar en MongoDB Atlas en crearIncidenciaDb, guardando en respaldo local:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  let folio: string;
  try {
    const next = await getNextFolio(anio);
    folio = next.folio;
  } catch {
    const nextNumber = INCIDENCIAS_INICIALES.length + 1;
    folio = `INC-${anio}-${String(nextNumber).padStart(4, "0")}`;
  }

  const { evidencias, ...restData } = payload;
  const evidenciasLocales = await Promise.all(
    (evidencias ?? []).map(async (item) => {
      let storageKey = `evidencias-utm/${anio}/${payload.categoria}/${folio}/${item.nombre_archivo}`;
      let pesoKb = item.peso_kb;
      let urlFirmada: string | null = item.contenido_base64
        ? `data:${item.tipo_mime};base64,${item.contenido_base64}`
        : null;

      if (hasSupabaseConfigured() && item.contenido_base64) {
        try {
          const archivoBuffer = Buffer.from(item.contenido_base64, "base64");
          const uploaded = await subirArchivoEvidencia({
            archivoBuffer,
            nombreArchivo: item.nombre_archivo,
            tipoMime: item.tipo_mime,
            categoria: payload.categoria,
            folio,
          });
          storageKey = uploaded.storageKey;
          pesoKb = uploaded.pesoKb;
          urlFirmada = (await generarUrlFirmada(storageKey)) ?? urlFirmada;
        } catch {
          // Conservar preview base64 si falla la subida
        }
      }

      return {
        nombre_archivo: item.nombre_archivo,
        tipo_mime: item.tipo_mime,
        peso_kb: pesoKb,
        url_storage: storageKey,
        storage_key: storageKey,
        fecha_carga: now.toISOString(),
        ...(urlFirmada ? { url_firmada: urlFirmada } : {}),
      };
    }),
  );

  const created: IncidenciaCampus = {
    _id: `mock-${crypto.randomUUID()}`,
    folio,
    ...restData,
    estado: "abierta",
    horas_invertidas: 0,
    fecha_creacion: now.toISOString(),
    historial_seguimiento: [
      {
        fecha: now.toISOString(),
        autor: payload.reportante.nombre,
        estado_nuevo: "abierta",
        horas_sumadas: 0,
        comentario: "Incidencia creada por el reportante.",
      },
    ],
    evidencias_adjuntas: evidenciasLocales,
  };
  INCIDENCIAS_INICIALES.unshift(created);
  return created;
}

export async function actualizarTriageDb(
  id: string,
  body: {
    prioridad?: Prioridad;
    id_tecnico?: string;
    riesgo_seguridad?: string;
    autor?: string;
  },
): Promise<{ data?: IncidenciaCampus; error?: string; status?: number }> {
  const actual = await obtenerIncidenciaDb(id);
  if (!actual) return { error: "Incidencia no encontrada", status: 404 };

  const cambios: string[] = [];
  const setFields: Record<string, unknown> = {};
  const unsetFields: Record<string, unknown> = {};

  if (body.prioridad && PRIORIDADES.includes(body.prioridad) && body.prioridad !== actual.prioridad) {
    setFields.prioridad = body.prioridad;
    actual.prioridad = body.prioridad;
    cambios.push(`Prioridad definida como ${PRIORIDAD_META[body.prioridad].etiqueta}`);
  }

  if (typeof body.id_tecnico === "string") {
    if (!body.id_tecnico) {
      if (actual.tecnico_asignado) {
        unsetFields.tecnico_asignado = "";
        delete actual.tecnico_asignado;
        cambios.push("Se retiró la asignación de técnico");
      }
    } else {
      const tecnico = TECNICOS_DISPONIBLES.find((item) => item.id_usuario === body.id_tecnico);
      if (!tecnico) return { error: "Técnico seleccionado no válido.", status: 400 };
      if (actual.tecnico_asignado?.id_usuario !== tecnico.id_usuario) {
        setFields.tecnico_asignado = tecnico;
        actual.tecnico_asignado = tecnico;
        cambios.push(`Asignada a ${tecnico.nombre}`);
      }
    }
  }

  if (
    body.riesgo_seguridad &&
    "riesgo_seguridad" in actual.detalle_especifico &&
    actual.detalle_especifico.riesgo_seguridad !== body.riesgo_seguridad
  ) {
    setFields["detalle_especifico.riesgo_seguridad"] = toDbRiesgo(body.riesgo_seguridad);
    actual.detalle_especifico.riesgo_seguridad = body.riesgo_seguridad;
    cambios.push(`Riesgo de seguridad evaluado como ${body.riesgo_seguridad}`);
  }

  if (hasMongoConfigured() && cambios.length > 0) {
    try {
      const db = await getDb();
      const col = db.collection(COLLECTION);
      const updateOp: Document = {
        $push: {
          historial_seguimiento: {
            fecha: new Date(),
            autor: body.autor?.trim() || "Coordinación",
            estado_nuevo: toDbEstado(actual.estado),
            horas_sumadas: 0,
            comentario: `${cambios.join(" · ")}.`,
          },
        },
      };
      if (Object.keys(setFields).length > 0) updateOp.$set = setFields;
      if (Object.keys(unsetFields).length > 0) updateOp.$unset = unsetFields;

      await col.updateOne(buildIdFilter(id), updateOp);
      const updated = await obtenerIncidenciaDb(id);
      return { data: updated ?? actual };
    } catch (err) {
      console.warn(
        "[db] No se pudo actualizar triage en MongoDB Atlas, aplicando en respaldo local:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (cambios.length > 0) {
    actual.historial_seguimiento.unshift({
      fecha: new Date().toLocaleString("es-MX"),
      autor: body.autor?.trim() || "Coordinación",
      estado_nuevo: actual.estado,
      horas_sumadas: 0,
      comentario: `${cambios.join(" · ")}.`,
    });
  }

  return { data: actual };
}

export async function actualizarEstadoDb(
  id: string,
  params: {
    estado_nuevo: EstadoIncidencia;
    horas_sumadas: number;
    comentario: string;
    autor: string;
  },
): Promise<IncidenciaCampus | null> {
  if (hasMongoConfigured()) {
    try {
      const db = await getDb();
      const col = db.collection(COLLECTION);
      const now = new Date();
      const esFinal = params.estado_nuevo === "resuelta" || params.estado_nuevo === "cerrada";

      const updateOp: Document = {
        $set: {
          estado: toDbEstado(params.estado_nuevo),
          ...(esFinal ? { fecha_resolucion: now } : {}),
        },
        ...(esFinal ? {} : { $unset: { fecha_resolucion: "" } }),
        $inc: { horas_invertidas: params.horas_sumadas },
        $push: {
          historial_seguimiento: {
            fecha: now,
            autor: params.autor,
            estado_nuevo: toDbEstado(params.estado_nuevo),
            horas_sumadas: params.horas_sumadas,
            comentario: params.comentario.trim(),
          },
        },
      };

      const res = await col.updateOne(buildIdFilter(id), updateOp);
      if (res.matchedCount === 0) return null;
      return obtenerIncidenciaDb(id);
    } catch (err) {
      console.warn(
        "[db] No se pudo actualizar estado en MongoDB Atlas, aplicando en respaldo local:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const incidencia = INCIDENCIAS_INICIALES.find((item) => item._id === id || item.folio === id);
  if (!incidencia) return null;
  incidencia.estado = params.estado_nuevo;
  incidencia.horas_invertidas += params.horas_sumadas;
  if (params.estado_nuevo === "resuelta" || params.estado_nuevo === "cerrada") {
    incidencia.fecha_resolucion = new Date().toISOString();
  } else {
    delete incidencia.fecha_resolucion;
  }
  incidencia.historial_seguimiento.unshift({
    fecha: new Date().toLocaleString("es-MX"),
    autor: params.autor,
    estado_nuevo: params.estado_nuevo,
    horas_sumadas: params.horas_sumadas,
    comentario: params.comentario.trim(),
  });
  return incidencia;
}

export async function actualizarTagsDb(
  id: string,
  action: "add" | "remove",
  tag: string,
): Promise<string[] | null> {
  if (hasMongoConfigured()) {
    try {
      const db = await getDb();
      const col = db.collection(COLLECTION);
      const updateOp: Document =
        action === "add" ? { $addToSet: { tags: tag } } : { $pull: { tags: tag } };
      const res = await col.updateOne(buildIdFilter(id), updateOp);
      if (res.matchedCount === 0) return null;
      const updated = await obtenerIncidenciaDb(id);
      return updated?.tags ?? [];
    } catch (err) {
      console.warn(
        "[db] No se pudo actualizar tags en MongoDB Atlas, aplicando en respaldo local:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const incidencia = INCIDENCIAS_INICIALES.find((item) => item._id === id || item.folio === id);
  if (!incidencia) return null;
  if (action === "add" && !incidencia.tags.includes(tag)) incidencia.tags.push(tag);
  if (action === "remove") incidencia.tags = incidencia.tags.filter((item) => item !== tag);
  return incidencia.tags;
}

export async function obtenerAnaliticaDb() {
  if (hasMongoConfigured()) {
    try {
      const db = await getDb();
      const col = db.collection(COLLECTION);

      const [eficienciaRaw, topTagsRaw] = await Promise.all([
        col
          .aggregate([
            { $match: { estado: { $in: ["resuelta", "cerrada"] } } },
            {
              $group: {
                _id: "$ubicacion.edificio",
                tickets_resueltos_cerrados: { $sum: 1 },
                horas_totales: { $sum: "$horas_invertidas" },
                promedio_horas: { $avg: "$horas_invertidas" },
              },
            },
            { $sort: { tickets_resueltos_cerrados: -1, horas_totales: -1 } },
          ])
          .toArray(),
        col
          .aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", frecuencia: { $sum: 1 } } },
            { $sort: { frecuencia: -1, _id: 1 } },
            { $limit: 10 },
          ])
          .toArray(),
      ]);

      return {
        eficiencia_por_edificio: eficienciaRaw.map((item) => ({
          edificio: String(item._id ?? ""),
          tickets_resueltos_cerrados: Number(item.tickets_resueltos_cerrados ?? 0),
          horas_totales: Number(item.horas_totales ?? 0),
          promedio_horas: Number(item.promedio_horas ?? 0),
        })),
        top_tags: topTagsRaw.map((item) => ({
          tag: String(item._id ?? ""),
          frecuencia: Number(item.frecuencia ?? 0),
        })),
      };
    } catch (err) {
      console.warn(
        "[db] No se pudo consultar MongoDB Atlas en obtenerAnaliticaDb, usando respaldo local:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const RESUELTOS = new Set(["resuelta", "cerrada"]);
  const edificios = new Map<string, { edificio: string; tickets_resueltos_cerrados: number; horas_totales: number }>();
  const tags = new Map<string, number>();

  for (const incidencia of INCIDENCIAS_INICIALES) {
    for (const tag of incidencia.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    if (!RESUELTOS.has(incidencia.estado)) continue;
    const current = edificios.get(incidencia.ubicacion.edificio) ?? {
      edificio: incidencia.ubicacion.edificio,
      tickets_resueltos_cerrados: 0,
      horas_totales: 0,
    };
    current.tickets_resueltos_cerrados += 1;
    current.horas_totales += incidencia.horas_invertidas;
    edificios.set(incidencia.ubicacion.edificio, current);
  }

  return {
    eficiencia_por_edificio: [...edificios.values()].map((item) => ({
      ...item,
      promedio_horas: item.tickets_resueltos_cerrados
        ? item.horas_totales / item.tickets_resueltos_cerrados
        : 0,
    })),
    top_tags: [...tags.entries()]
      .map(([tag, frecuencia]) => ({ tag, frecuencia }))
      .sort((a, b) => b.frecuencia - a.frecuencia || a.tag.localeCompare(b.tag))
      .slice(0, 10),
  };
}
