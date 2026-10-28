import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  MIME_PERMITIDOS,
  MAX_PESO_KB,
  subirArchivoEvidencia,
  generarUrlFirmada,
} from "@/lib/supabase";
import {
  getIncidencia,
  type EvidenciaAdjunta,
} from "@/lib/incidencias/mock-data";
import { hasPermission, type FrontendRole } from "@/lib/rbac";

type TipoMimePermitido = (typeof MIME_PERMITIDOS)[number];

function esMimePermitido(mime: string): mime is TipoMimePermitido {
  return (MIME_PERMITIDOS as readonly string[]).includes(mime);
}

async function obtenerColeccionMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === "") return null;

  const db = await getDb();
  return {
    collection: db.collection("incidencias_campus"),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let mongoConn: Awaited<ReturnType<typeof obtenerColeccionMongo>> = null;

  try {
    mongoConn = await obtenerColeccionMongo();

    if (mongoConn) {
      const filtro = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { folio: id }] }
        : { folio: id };

      const doc = await mongoConn.collection.findOne(filtro, {
        projection: { evidencias_adjuntas: 1 },
      });

      if (!doc) {
        return NextResponse.json(
          { error: "Incidencia no encontrada" },
          { status: 404 }
        );
      }

      const evidenciasConUrl = await Promise.all(
        (doc.evidencias_adjuntas || []).map(async (ev: EvidenciaAdjunta) => {
          const key = ev.storage_key || ev.url_storage;
          const urlFirmada = key ? await generarUrlFirmada(key) : null;
          return {
            ...ev,
            storage_key: key,
            url_storage: urlFirmada || ev.url_storage || key,
            url_firmada: urlFirmada,
          };
        })
      );

      return NextResponse.json(
        { evidencias_adjuntas: evidenciasConUrl },
        { status: 200 }
      );
    }

    const incidenciaLocal = getIncidencia(id);
    if (!incidenciaLocal) {
      return NextResponse.json(
        { error: "Incidencia no encontrada" },
        { status: 404 }
      );
    }

    const evidenciasConUrl = await Promise.all(
      incidenciaLocal.evidencias_adjuntas.map(async (ev) => {
        const key = ev.storage_key || ev.url_storage;
        const urlFirmada = key ? await generarUrlFirmada(key) : null;
        return {
          ...ev,
          storage_key: key,
          url_storage: urlFirmada || ev.url_storage || key,
          url_firmada: urlFirmada,
        };
      })
    );

    return NextResponse.json(
      { evidencias_adjuntas: evidenciasConUrl },
      { status: 200 }
    );
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "Error al consultar evidencias";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const role = request.headers.get("x-user-role") as FrontendRole | null;
  if (role && !hasPermission(role, "evidencia:upload")) {
    return NextResponse.json(
      { error: "Tu rol no puede subir evidencias." },
      { status: 403 }
    );
  }

  let mongoConn: Awaited<ReturnType<typeof obtenerColeccionMongo>> = null;

  try {
    let nombreArchivo = "";
    let tipoMime = "";
    let pesoKb = 0;
    let archivoBuffer: Buffer | null = null;

    const rawBuffer = await request.arrayBuffer();
    const textPreview = Buffer.from(rawBuffer.slice(0, 64))
      .toString("utf-8")
      .trim();

    if (textPreview.startsWith("{")) {
      const body = JSON.parse(Buffer.from(rawBuffer).toString("utf-8"));
      nombreArchivo = body.nombre_archivo || "";
      tipoMime = body.tipo_mime || "";
      pesoKb = typeof body.peso_kb === "number" ? body.peso_kb : 0;

      if (body.contenido_base64) {
        archivoBuffer = Buffer.from(body.contenido_base64, "base64");
      } else {
        archivoBuffer = Buffer.from(
          `Evidencia registrada para ${nombreArchivo}`
        );
      }
    } else {
      const contentType = request.headers.get("content-type") || "";
      const reqClonada = new Request(request.url, {
        method: "POST",
        headers: { "content-type": contentType },
        body: rawBuffer,
      });

      const formData = await reqClonada.formData();
      const archivo = (formData.get("archivo") ||
        formData.get("file")) as File | null;

      if (!archivo || typeof archivo === "string") {
        return NextResponse.json(
          {
            error:
              'Debes enviar un archivo válido en el campo "archivo" (form-data)',
          },
          { status: 400 }
        );
      }

      nombreArchivo = archivo.name;
      tipoMime = archivo.type;
      pesoKb = Number((archivo.size / 1024).toFixed(2));
      archivoBuffer = Buffer.from(await archivo.arrayBuffer());
    }

    if (
      !nombreArchivo ||
      !esMimePermitido(tipoMime) ||
      pesoKb <= 0 ||
      pesoKb > MAX_PESO_KB
    ) {
      return NextResponse.json(
        {
          error:
            "Formato no permitido o archivo mayor a 5120 KB (5 MB). Solo se aceptan image/png, image/jpeg y application/pdf.",
        },
        { status: 400 }
      );
    }

    mongoConn = await obtenerColeccionMongo();

    let folio = "INC-2026-0001";
    let categoria = "infraestructura";
    let filtroMongo: Record<string, unknown> | null = null;

    if (mongoConn) {
      filtroMongo = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { folio: id }] }
        : { folio: id };

      const docExistente = await mongoConn.collection.findOne(filtroMongo, {
        projection: { folio: 1, categoria: 1 },
      });

      if (!docExistente) {
        return NextResponse.json(
          { error: "Incidencia no encontrada en MongoDB Atlas" },
          { status: 404 }
        );
      }

      folio = docExistente.folio;
      categoria = docExistente.categoria;
    } else {
      const incidenciaLocal = getIncidencia(id);
      if (!incidenciaLocal) {
        return NextResponse.json(
          { error: "Incidencia no encontrada" },
          { status: 404 }
        );
      }
      folio = incidenciaLocal.folio;
      categoria = incidenciaLocal.categoria;
    }

    const { storageKey } = await subirArchivoEvidencia({
      archivoBuffer: archivoBuffer!,
      nombreArchivo,
      tipoMime,
      categoria,
      folio,
    });

    const urlFirmada = await generarUrlFirmada(storageKey);

    if (mongoConn && filtroMongo) {
      const subdocumentoMongo = {
        nombre_archivo: nombreArchivo,
        tipo_mime: tipoMime,
        peso_kb: pesoKb,
        storage_key: storageKey,
        fecha_carga: new Date(),
      };

      const resultado = await mongoConn.collection.findOneAndUpdate(
        filtroMongo,
        { $push: { evidencias_adjuntas: subdocumentoMongo } as never },
        { returnDocument: "after", projection: { evidencias_adjuntas: 1 } }
      );

      const evidenciasConUrl = await Promise.all(
        (resultado?.evidencias_adjuntas || []).map(
          async (ev: EvidenciaAdjunta) => {
            const key = ev.storage_key || ev.url_storage;
            const firmada = key ? await generarUrlFirmada(key) : null;
            return {
              ...ev,
              storage_key: key,
              url_storage: firmada || ev.url_storage || key,
              url_firmada: firmada,
            };
          }
        )
      );

      return NextResponse.json(
        {
          data: {
            ...subdocumentoMongo,
            url_storage: urlFirmada || storageKey,
            url_firmada: urlFirmada,
          },
          evidencias_adjuntas: evidenciasConUrl,
        },
        { status: 201 }
      );
    }

    const incidenciaLocal = getIncidencia(id)!;
    const evidenciaLocal: EvidenciaAdjunta = {
      nombre_archivo: nombreArchivo,
      tipo_mime: tipoMime,
      peso_kb: pesoKb,
      fecha_carga: new Date().toISOString(),
      url_storage: urlFirmada || storageKey,
      storage_key: storageKey,
      url_firmada: urlFirmada,
    };

    incidenciaLocal.evidencias_adjuntas.push(evidenciaLocal);

    return NextResponse.json(
      {
        data: evidenciaLocal,
        evidencias_adjuntas: incidenciaLocal.evidencias_adjuntas,
      },
      { status: 201 }
    );
  } catch (error) {
    const mensaje =
      error instanceof Error
        ? error.message
        : "Error interno al procesar la evidencia";
    console.error("Error en POST evidencias:", error);
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
