"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Charge une vue de l'administration depuis la base.
 * live = false : pas de base configurée (503) → la page affiche ses données d'exemple.
 */
export function useAdmin<T>(vue: string, params = "") {
  const [data, setData] = useState<T | null>(null);
  const [live, setLive] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/data?vue=${vue}${params}`, { cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (r.status === 503) {
        setLive(false);
        return;
      }
      if (!r.ok) throw new Error();
      setData((await r.json()) as T);
      setLive(true);
      setError(null);
    } catch {
      setError("Chargement impossible.");
      setLive(false);
    }
  }, [vue, params]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, live, error, reload: load };
}

export async function adminPost<T = unknown>(body: unknown): Promise<{ ok: boolean; error?: string; envoyees?: number; gagnant?: T }> {
  const r = await fetch("/api/admin/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, error: j.error, envoyees: j.envoyees, gagnant: j.gagnant };
}

export function SourceBadge({ live }: { live: boolean | null }) {
  if (live === null) return null;
  return live ? <span className="badge b-ok">Données réelles</span> : <span className="badge b-warn">Données d&apos;exemple · base non configurée</span>;
}

export const ago = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`;
};
