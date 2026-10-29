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
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
    return global._mongoClientPromise;
  }

  if (!clientPromiseInstance) {
    const client = new MongoClient(uri, options);
    clientPromiseInstance = client.connect();
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
