"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/SessionProvider";

export default function PortalPage() {
  const { session, hydrated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated || !session) return;
    const destination = session.role === "admin" ? "/" : session.role === "directiva" ? "/analitica" : session.role === "reportante" ? "/mis-incidencias" : "/incidencias";
    router.replace(destination);
  }, [hydrated, router, session]);

  return <main className="grid min-h-[calc(100vh-73px)] place-items-center bg-[#f7f6ff] text-sm text-slate-500">Cargando tu consola operativa...</main>;
}
