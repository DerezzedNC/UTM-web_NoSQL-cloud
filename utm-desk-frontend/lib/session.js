'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export function useSession() {
  const [u, setU] = useState(null); const r = useRouter();
  useEffect(() => { const s = localStorage.getItem('usuario'); s ? setU(JSON.parse(s)) : r.replace('/login'); }, [r]);
  return u;
}
