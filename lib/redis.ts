import { Redis } from "@upstash/redis";

declare global {
  var _redisClientInstance: Redis | undefined;
}

let redisInstance: Redis | undefined;

/** Límite superior del correlativo anual por el formato INC-AAAA-NNNN (4 dígitos). */
export const MAX_FOLIO_SEQUENCE = 9999;

/**
 * Sanitiza mensajes de error para no filtrar tokens o URLs de Upstash.
 * Primero reemplaza literalmente los valores configurados en el entorno y
 * después aplica los patrones genéricos.
 */
export function sanitizeRedisError(errorText: string): string {
  let sanitized = errorText;

  const secretValues = [
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.UPSTASH_REDIS_REST_URL,
  ];
  for (const secret of secretValues) {
    if (secret && secret.trim()) {
      // split/join evita tener que escapar caracteres especiales de regex
      sanitized = sanitized.split(secret).join("[REDACTED]");
    }
  }

  return sanitized
    .replace(/https:\/\/[^\s]+/gi, "https://[REDACTED_UPSTASH_URL]")
    .replace(/bearer\s+[a-zA-Z0-9_-]+/gi, "Bearer [REDACTED_TOKEN]");
}

/**
 * Obtiene el cliente de Upstash Redis en modo Singleton.
 * Valida que existan UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.
 */
export function getRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !url.trim() || !token || !token.trim()) {
    throw new Error(
      "Variables de entorno de Upstash Redis incompletas (UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN faltantes). Verifica .env.local"
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._redisClientInstance) {
      global._redisClientInstance = new Redis({ url, token });
    }
    return global._redisClientInstance;
  }

  if (!redisInstance) {
    redisInstance = new Redis({ url, token });
  }

  return redisInstance;
}

/**
 * Función pura: obtiene el año del folio a partir de una fecha dada.
 * El endpoint POST debe calcular `const anio = getAnioFolio(fecha)` una sola vez
 * y reutilizarlo tanto en `getNextFolio(anio)` como en `fecha_creacion`.
 */
export function getAnioFolio(fecha: Date): number {
  return fecha.getFullYear();
}

/**
 * Genera el nombre canónico de la clave atómica en Redis para el año en curso o el especificado.
 * Formato requerido: contador:incidencias:AAAA (ejemplo: contador:incidencias:2026).
 */
export function getIncidentCounterKey(year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `contador:incidencias:${y}`;
}

/**
 * Formatea un número correlativo al estándar institucional de folios: INC-AAAA-NNNN.
 */
export function formatFolio(year: number, sequence: number): string {
  return `INC-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Incrementa atómicamente el contador anual en Upstash Redis y devuelve el folio formal generado.
 * Garantiza cero condiciones de carrera ante peticiones concurrentes.
 */
export async function getNextFolio(year?: number): Promise<{ folio: string; counter: number }> {
  const currentYear = year ?? new Date().getFullYear();
  const counterKey = getIncidentCounterKey(currentYear);
  const client = getRedisClient();

  const counter = await client.incr(counterKey);

  // No se decrementa: el valor consumido queda registrado y no se reutiliza.
  if (counter > MAX_FOLIO_SEQUENCE) {
    throw new Error("Límite anual de folios alcanzado");
  }

  const folio = formatFolio(currentYear, counter);

  return { folio, counter };
}

/**
 * Verifica la conectividad real con Upstash Redis ejecutando PING.
 */
export async function checkRedisConnection(): Promise<{
  ok: boolean;
  pingMs?: number;
  error?: string;
}> {
  try {
    const client = getRedisClient();
    const start = Date.now();
    const response = await client.ping();
    const pingMs = Date.now() - start;

    if (response === "PONG") {
      return { ok: true, pingMs };
    }

    return {
      ok: false,
      error: "Respuesta inesperada al ejecutar PING contra Upstash Redis",
    };
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error al conectar con Upstash Redis";
    return {
      ok: false,
      error: sanitizeRedisError(rawMessage),
    };
  }
}

/**
 * Garantiza que el contador anual sea al menos `minValue` sin reducirlo nunca.
 * - Si el valor actual ya es >= minValue, no escribe nada.
 * - Si es menor, aplica INCRBY con la diferencia (nunca SET).
 * Nota: si otro proceso ejecuta INCR entre el GET y el INCRBY, el contador puede
 * quedar por encima de minValue (se saltan números), pero jamás se duplica un folio.
 */
export async function ensureCounterAtLeast(
  year: number,
  minValue: number
): Promise<{ previous: number; final: number; counterKey: string }> {
  const counterKey = getIncidentCounterKey(year);
  const client = getRedisClient();

  const raw = await client.get<string | number>(counterKey);
  const previous = Number(raw ?? 0);
  if (Number.isNaN(previous)) {
    throw new Error(`El contador ${counterKey} contiene un valor no numérico`);
  }

  if (previous >= minValue) {
    return { previous, final: previous, counterKey };
  }

  const final = await client.incrby(counterKey, minValue - previous);
  return { previous, final, counterKey };
}

/**
 * Instancia delegada (Proxy) para acceso directo a Redis con resolución perezosa de credenciales.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});

export default redis;
