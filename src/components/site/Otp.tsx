"use client";

import { useRef } from "react";

/** Saisie d'un code OTP à 6 chiffres reçu par SMS. */
export function Otp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  return (
    <div className="otp" role="group" aria-label="Code reçu par SMS">
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
            const v = e.target.value.replace(/\D/g, "");
            if (!v) {
              onChange(value.slice(0, i) + value.slice(i + 1));
              return;
            }
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
