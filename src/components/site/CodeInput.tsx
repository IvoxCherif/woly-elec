"use client";

import { useEffect, useRef, useState } from "react";

/** Saisie d'un code à 6 chiffres reçu par e-mail (collage accepté). */
export function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  return (
    <div className="otp" role="group" aria-label="Code à 6 chiffres reçu par e-mail">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          aria-label={`Chiffre ${i + 1}`}
          value={d}
          onChange={(e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (!v) {
              onChange(value.slice(0, i) + value.slice(i + 1));
              return;
            }
            // Case déjà remplie : le nouveau chiffre remplace l'ancien au lieu de s'y ajouter
            if (d && v.length === 2) v = v[0] === d ? v[1] : v[0];
            const next = (value.slice(0, i) + v).slice(0, 6);
            onChange(next);
            refs.current[Math.min(5, next.length)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

/** Décompte de validité du code (10 minutes) : temps restant, puis « code expiré » avec renvoi. */
export function CodeTimer({ sentAt, minutes = 10, onResend, busy }: { sentAt: number | null; minutes?: number; onResend?: () => void; busy?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!sentAt) return null;
  const left = Math.max(0, Math.ceil((sentAt + minutes * 60_000 - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="row wrapf" style={{ gap: 10 }}>
      {left > 0 ? (
        <span className="badge b-gr">Code valable encore {mm}:{ss}</span>
      ) : (
        <span className="badge b-risk">Code expiré</span>
      )}
      {onResend && (
        <button type="button" className="sm" style={{ color: "var(--blue)", fontWeight: 600 }} disabled={busy} onClick={onResend}>
          {left > 0 ? "Je n'ai rien reçu : renvoyer le code" : "Recevoir un nouveau code"}
        </button>
      )}
    </div>
  );
}
