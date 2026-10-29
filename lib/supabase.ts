import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_EVIDENCIAS = "evidencias-utm";
export const URL_FIRMADA_VIGENCIA_SEGUNDOS = 3600; // 1 hora (RNF-01 / CU-02)
export const MIME_PERMITIDOS = ["image/png", "image/jpeg", "application/pdf"] as const;
export type TipoMimePermitido = (typeof MIME_PERMITIDOS)[number];
export const MAX_PESO_BYTES = 5 * 1024 * 1024; // 5 MB (RNF-07)
export const MAX_PESO_KB = 5120;

let supabaseInstance: SupabaseClient | null = null;
let bucketVerified = false;

/**
 * Normaliza SUPABASE_URL por si tiene comillas, barras finales o rutas de dashboard/storage
 */
export function normalizarSupabaseUrl(rawUrl: string): string {
  const limpia = rawUrl.trim().replace(/^["']|["']$/g, "");

  // Si pegaron el link del dashboard: https://supabase.com/dashboard/project/xyz...
  const matchDashboard = limpia.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (matchDashboard?.[1]) {
    return `https://${matchDashboard[1]}.supabase.co`;
  }

  // Extraer únicamente el origen https://xyz.supabase.co sin rutas adicionales
  const urlObj = new URL(limpia);
  return urlObj.origin;
}

export function hasSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const rawUrl = process.env.SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !rawKey) {
    throw new Error(
      "Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
    );
  }

  const supabaseUrl = normalizarSupabaseUrl(rawUrl);
  const supabaseServiceKey = rawKey.trim().replace(/^["']|["']$/g, "");

  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseInstance;
}

/**
 * Permite inyectar un cliente de Supabase (doble de prueba) para suites automatizadas
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null) {
  supabaseInstance = client;
  bucketVerified = client !== null;
}

async function ensureBucketExists(supabase: SupabaseClient) {
  if (bucketVerified) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_EVIDENCIAS);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_EVIDENCIAS, {
        public: false,
        fileSizeLimit: MAX_PESO_BYTES,
        allowedMimeTypes: ["image/png", "image/jpeg", "application/pdf"],
      });
    }
    bucketVerified = true;
  } catch {
    // Continuar e intentar subir directamente
  }
}

export function extraerRutaInternaBucket(storageKey: string): string {
  const prefijo = `${BUCKET_EVIDENCIAS}/`;
  const ruta = storageKey.startsWith(prefijo)
    ? storageKey.slice(prefijo.length)
    : storageKey;
  return ruta.replace(/^\/+/, "");
}

export async function subirArchivoEvidencia(params: {
  archivoBuffer: Buffer | ArrayBuffer | Uint8Array;
  nombreArchivo: string;
  tipoMime: string;
  categoria: string;
  folio: string;
}): Promise<{ storageKey: string; pesoKb: number }> {
  const { archivoBuffer, nombreArchivo, tipoMime, categoria, folio } = params;

  const supabase = getSupabaseClient();
  await ensureBucketExists(supabase);

  const anio = new Date().getFullYear();
  const nombreLimpio = nombreArchivo.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const rutaInterna = `${anio}/${categoria}/${folio}/${nombreLimpio}`;
  const storageKey = `${BUCKET_EVIDENCIAS}/${rutaInterna}`;

  const { error } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(rutaInterna, archivoBuffer, {
      contentType: tipoMime,
      upsert: true,
    });

  if (error) {
    throw new Error(`Error al subir archivo a Supabase Storage: ${error.message}`);
  }

  const byteLength =
    archivoBuffer instanceof ArrayBuffer
      ? archivoBuffer.byteLength
      : archivoBuffer.length;
  const pesoKb = Number((byteLength / 1024).toFixed(2));

  return { storageKey, pesoKb };
}

export async function generarUrlFirmada(storageKey: string): Promise<string | null> {
  if (!hasSupabaseConfigured() || !storageKey) return null;
  try {
    const supabase = getSupabaseClient();
    const rutaInterna = extraerRutaInternaBucket(storageKey);

    const { data, error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .createSignedUrl(rutaInterna, URL_FIRMADA_VIGENCIA_SEGUNDOS);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}
