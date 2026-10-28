import { NextResponse } from "next/server";
import { checkMongoConnection } from "@/lib/mongodb";
import { checkRedisConnection } from "@/lib/redis";

export async function GET() {
  const timestamp = new Date().toISOString();

  // Ejecutamos ambas comprobaciones en paralelo para optimizar la latencia
  const [mongoResult, redisResult] = await Promise.all([
    checkMongoConnection(),
    checkRedisConnection(),
  ]);

  const allHealthy = mongoResult.ok && redisResult.ok;
  const anyHealthy = mongoResult.ok || redisResult.ok;

  const overallStatus = allHealthy
    ? "healthy"
    : anyHealthy
    ? "degraded"
    : "unhealthy";

  const responseBody = {
    status: overallStatus,
    timestamp,
    services: {
      mongodb: {
        status: mongoResult.ok ? "connected" : "error",
        database: mongoResult.database || "utm_desk_db",
        ...(mongoResult.pingMs !== undefined && { latency_ms: mongoResult.pingMs }),
        ...(mongoResult.error && { error: mongoResult.error }),
      },
      redis: {
        status: redisResult.ok ? "connected" : "error",
        ...(redisResult.pingMs !== undefined && { latency_ms: redisResult.pingMs }),
        ...(redisResult.error && { error: redisResult.error }),
      },
    },
  };

  const httpStatus = allHealthy ? 200 : 503;

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
