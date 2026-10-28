'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export function useSession() {
  const [u, setU] = useState(null); const r = useRouter();
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem('usuario') || 'null');
      if (value && typeof value === 'object' && typeof value.rol === 'string') setU(value);
      else { localStorage.clear(); r.replace('/login'); }
    } catch {
      localStorage.clear();
      r.replace('/login');
    }
  }, [r]);
  return u;
}
