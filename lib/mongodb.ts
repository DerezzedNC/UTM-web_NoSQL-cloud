import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

/**
 * Nombre predeterminado de la base de datos en MongoDB Atlas.
 * Cumple con la especificación técnica acordada para UTM Desk NoSQL Cloud.
 */
export const DEFAULT_DB_NAME = "utm_desk_db";

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromiseInstance: Promise<MongoClient> | undefined;

/**
 * Sanitiza mensajes de error para no exponer contraseñas ni cadenas completas de conexión.
 */
export function sanitizeMongoError(errorText: string): string {
  return errorText.replace(/mongodb(\+srv)?:\/\/[^\s@]+@/gi, "mongodb$1://[REDACTED_CREDENTIALS]@");
}

/**
 * Si el DNS UDP local bloquea o hace timeout en registros SRV (`querySrv ETIMEOUT` / `ECONNREFUSED`),
 * resuelve los registros SRV y TXT de MongoDB Atlas mediante DNS-over-HTTPS (puerto 443) y construye
 * la cadena de conexión directa `mongodb://host1:27017,host2:27017,host3:27017/...`.
 */
async function resolveSrvViaDoH(srvUri: string): Promise<string | null> {
  try {
    const parsed = new URL(srvUri);
    if (parsed.protocol !== "mongodb+srv:") return null;

    const host = parsed.hostname;
    const [srvRes, txtRes] = await Promise.all([
      fetch(`https://dns.google/resolve?name=_mongodb._tcp.${encodeURIComponent(host)}&type=SRV`, {
        signal: AbortSignal.timeout(4000),
      }),
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`, {
        signal: AbortSignal.timeout(4000),
      }),
    ]);

    if (!srvRes.ok) return null;
    const srvJson = (await srvRes.json()) as {
      Answer?: Array<{ data: string }>;
    };

    const answers = srvJson.Answer ?? [];
    const hosts: string[] = [];
    for (const ans of answers) {
      // Formato SRV data: "priority weight port target."
      const parts = ans.data.trim().split(/\s+/);
      if (parts.length >= 4) {
        const port = parts[2];
        const target = parts[3].replace(/\.$/, "");
        hosts.push(`${target}:${port}`);
      }
    }

    if (hosts.length === 0) return null;

    const searchParams = new URLSearchParams(parsed.search);
    if (txtRes.ok) {
      const txtJson = (await txtRes.json()) as {
        Answer?: Array<{ data: string }>;
      };
      for (const ans of txtJson.Answer ?? []) {
        const cleanTxt = ans.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "");
        const txtParams = new URLSearchParams(cleanTxt);
        for (const [k, v] of txtParams.entries()) {
          if (!searchParams.has(k)) searchParams.set(k, v);
        }
      }
    }

    if (!searchParams.has("tls") && !searchParams.has("ssl")) {
      searchParams.set("tls", "true");
    }
    if (!searchParams.has("authSource")) {
      searchParams.set("authSource", "admin");
    }
    if (!searchParams.has("retryWrites")) {
      searchParams.set("retryWrites", "true");
    }

    const auth = parsed.username
      ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
      : "";
    const pathname = parsed.pathname || "/";
    const queryString = searchParams.toString();

    return `mongodb://${auth}${hosts.join(",")}${pathname}${queryString ? `?${queryString}` : ""}`;
  } catch {
    return null;
  }
}

async function connectWithSrvFallback(uri: string): Promise<MongoClient> {
  try {
    const client = new MongoClient(uri, options);
    return await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (
      uri.startsWith("mongodb+srv://") &&
      (msg.includes("querySrv") ||
        msg.includes("ETIMEOUT") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("EREFUSED"))
    ) {
      const directUri = await resolveSrvViaDoH(uri);
      if (directUri) {
        const directClient = new MongoClient(directUri, options);
        return await directClient.connect();
      }
    }
    throw err;
  }
}

/**
 * Obtiene o inicializa la promesa de conexión a MongoDB Atlas mediante el patrón Singleton.
 * En modo desarrollo se preserva en `globalThis` para evitar agotar el pool de conexiones con Hot Reloading.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) {
    return global._mongoClientPromise;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    throw new Error(
      "La variable de entorno MONGODB_URI no está configurada o se encuentra vacía. Verifica .env.local"
    );
  }

  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = connectWithSrvFallback(uri.trim()).catch((err) => {
        global._mongoClientPromise = undefined;
        throw err;
      });
    }
    return global._mongoClientPromise;
  }

  if (!clientPromiseInstance) {
    clientPromiseInstance = connectWithSrvFallback(uri.trim()).catch((err) => {
      clientPromiseInstance = undefined;
      throw err;
    });
  }

  return clientPromiseInstance;
}

/**
 * Retorna el cliente conectado de MongoDB.
 */
export async function getMongoClient(): Promise<MongoClient> {
  return getMongoClientPromise();
}

/**
 * Retorna la instancia de la base de datos `utm_desk_db` (o la especificada).
 */
export async function getDb(databaseName?: string): Promise<Db> {
  const client = await getMongoClient();
  const dbName = databaseName || process.env.MONGODB_DB || DEFAULT_DB_NAME;
  return client.db(dbName);
}

/**
 * Verifica la conectividad activa contra MongoDB Atlas ejecutando { ping: 1 }.
 * No arroja excepciones no controladas ni expone credenciales.
 */
export async function checkMongoConnection(): Promise<{
  ok: boolean;
  pingMs?: number;
  database?: string;
  error?: string;
}> {
  try {
    const start = Date.now();
    const db = await getDb();
    await db.command({ ping: 1 });
    const pingMs = Date.now() - start;

    return {
      ok: true,
      pingMs,
      database: db.databaseName,
    };
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Error de conexión a MongoDB Atlas";
    return {
      ok: false,
      error: sanitizeMongoError(rawMessage),
    };
  }
}

/**
 * Proxy seguro para exportar clientPromise sin romper el build estático cuando MONGODB_URI no esté presente.
 */
const clientPromiseProxy: Promise<MongoClient> = new Proxy({} as Promise<MongoClient>, {
  get(_target, prop) {
    const promise = getMongoClientPromise();
    const value = (promise as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(promise);
    }
    return value;
  },
});

export default clientPromiseProxy;
