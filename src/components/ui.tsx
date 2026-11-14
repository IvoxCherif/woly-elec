"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";
import type { Level } from "@/lib/engine";

// ——— Logo ———

export function Logo({ dark, size = 44, tagline, href }: { dark?: boolean; size?: number; tagline?: boolean; href?: string }) {
  const inner = (
    <span className={`logo${dark ? " d" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark ? "/logo-icon.png" : "/logo-mark.png"} alt="" style={{ height: size }} />
      <span className="lw" style={size < 40 ? { fontSize: Math.round(size * 0.52) } : undefined}>
        <b>WOLY</b>
        <i>ELEC</i>
        {tagline && <span className="tg">Votre électricité, sous contrôle</span>}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Woly Elec — accueil" style={{ textDecoration: "none" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ——— Jauge en arc ———

function pt(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: 110 + 90 * Math.cos(a), y: 110 + 90 * Math.sin(a) };
}

export function Gauge({
  fraction,
  level,
  label = "Crédit restant",
  value,
  detail,
  size = 250,
}: {
  fraction: number;
  level: Level;
  label?: string;
  value: string;
  detail: string;
  size?: number;
}) {
  const id = useId().replace(/:/g, "");
  const f = Math.max(0.03, Math.min(1, fraction));
  const start = pt(135);
  const end = pt(135 + 270 * f);
  const large = 270 * f > 180 ? 1 : 0;
  const stroke = level === "ok" ? `url(#g${id})` : level === "warn" ? "#FACC15" : "#DC2626";
  const small = size < 220;
  return (
    <div className={`gw ${level}${small ? " sm" : ""}`} style={{ width: size, height: size }}>
      <svg className="gg" viewBox="0 0 220 220" width={size} height={size} role="img" aria-label={`Jauge : ${label} ${value}, ${detail}`}>
        <defs>
          <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="46" y1="174" x2="170" y2="60">
            <stop offset="0" stopColor="#1D4ED8" />
            <stop offset=".6" stopColor="#2F6BF0" />
            <stop offset="1" stopColor="#FACC15" />
          </linearGradient>
        </defs>
        <path d="M46.4 173.6 A90 90 0 1 1 173.6 173.6" fill="none" stroke="#E1E9E4" strokeWidth="15" strokeLinecap="round" />
        <path
          d={`M${start.x.toFixed(1)} ${start.y.toFixed(1)} A90 90 0 ${large} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
          fill="none"
          stroke={stroke}
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path d="M118 48 95 80h13l-6 22 24-33h-13z" fill={level === "warn" ? "#CA9A04" : "#FACC15"} />
      </svg>
      <div className="gc">
        <small>{label}</small>
        <span className="v">{value}</span>
        <span className="d">{detail}</span>
      </div>
    </div>
  );
}

// ——— Barre de tranche ———

export function TrancheBar({ bought, threshold = 150 }: { bought: number; threshold?: number }) {
  // la barre couvre 0 → 225 kWh, la tranche 1 occupe 2/3 (repère blanc à 66,6 %)
  const scale = threshold * 1.5;
  const w = Math.min(100, (bought / scale) * 100);
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="tr" role="img" aria-label={`${Math.round(bought)} kWh achetés ce mois-ci sur ${threshold} kWh en tranche 1`}>
        <b style={{ width: `${w}%` }} />
        <i />
      </div>
      <div className="trl">
        <span>0</span>
        <span>{threshold} kWh</span>
        <span>Tranche 2 · 136,49 F/kWh</span>
      </div>
    </div>
  );
}

// ——— Frise du mois ———

export function Frise({
  daysInMonth,
  today,
  depletionDay,
  rechargeDay,
  dark,
}: {
  daysInMonth: number;
  today: number;
  depletionDay: number | null;
  rechargeDay?: number | null;
  dark?: boolean;
}) {
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    let c = "f";
    if (d < today) c = "p";
    else if (d === today) c = "t";
    else if (rechargeDay && d === rechargeDay) c = "rc";
    else if (depletionDay !== null && d >= depletionDay) c = "r";
    return c;
  });
  return (
    <div
      className="frise"
      style={{ gridTemplateColumns: `repeat(${daysInMonth},minmax(0,1fr))` }}
      role="img"
      aria-label={`Frise du mois : aujourd'hui le ${today}${depletionDay ? `, coupure estimée le ${depletionDay}` : ", crédit suffisant jusqu'à la fin du mois"}${rechargeDay ? `, recharge conseillée le ${rechargeDay}` : ""}`}
    >
      {cells.map((c, i) => (
        <i key={i} className={c} style={dark && c === "f" ? { background: "#2f6b57" } : undefined} />
      ))}
    </div>
  );
}

// ——— Fiabilité ———

export function Confidence({ bars, label, count }: { bars: number; label: string; count: number }) {
  return (
    <div className="conf">
      <span className="bars" aria-hidden="true">
        {[6, 10, 14, 18].map((h, i) => (
          <i key={h} className={i < bars ? "" : "o"} style={{ height: h }} />
        ))}
      </span>
      Fiabilité : {label}, basée sur {count} relevé{count > 1 ? "s" : ""}
    </div>
  );
}

// ——— Alerte in-app ———

const ALERT_ICON = { info: "info", warn: "warn", red: "bolt", ok: "check" } as const;

export function Callout({ tone, title, children, icon }: { tone: "info" | "warn" | "red" | "ok"; title: string; children?: React.ReactNode; icon?: string }) {
  return (
    <div className={`alert al-${tone}`} role={tone === "red" ? "alert" : undefined}>
      <span className="ai">
        <Icon name={icon ?? ALERT_ICON[tone]} size="s" />
      </span>
      <div>
        <b>{title}</b>
        {children}
      </div>
    </div>
  );
}

// ——— Contrôles ———

export function Seg<T extends string>({ options, value, onChange, label, style }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; style?: React.CSSProperties }) {
  return (
    <div className="seg" role="group" aria-label={label} style={style}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="row" style={{ cursor: "pointer" }}>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="sw" onClick={() => onChange(!checked)} />
      <span className="sm ink" style={{ fontWeight: 600 }}>
        {label}
      </span>
    </label>
  );
}

export function NumField({
  label,
  unit,
  value,
  onChange,
  hint,
  error,
  big = true,
  autoFocus,
  placeholder,
  id,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  big?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const gen = useId();
  const fid = id ?? gen;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <div className={`inp${big ? " num" : ""}${error ? " err" : ""}`}>
        <input
          id={fid}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^\d,.\s]/g, ""))}
          aria-invalid={!!error}
          aria-describedby={hint || error ? `${fid}-h` : undefined}
        />
        {unit && <span className="u">{unit}</span>}
      </div>
      {(error || hint) && (
        <span id={`${fid}-h`} className={`hint${error ? " e" : ""}`}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export function TextField({ label, value, onChange, type = "text", placeholder, hint, prefix, autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string; prefix?: string; autoComplete?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="inp">
        {prefix && <span className="mut" style={{ fontWeight: 600 }}>{prefix}</span>}
        <input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

// ——— Modale ———

export function Modal({ open, onClose, title, subtitle, children, width = 560, light }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; width?: number; light?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,button,select,textarea,a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`overlay${light ? " light" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal col" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width, gap: 18 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="col" style={{ gap: 2 }}>
            <h2 className="h3" style={{ fontSize: 24 }}>{title}</h2>
            {subtitle && <span className="sm mut">{subtitle}</span>}
          </div>
          <span className="sp" />
          <button type="button" className="avatar" style={{ background: "var(--g1)" }} onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ——— Graphiques ———

export function LineChart({ values, height = 170, label }: { values: number[]; height?: number; label: string }) {
  if (values.length < 2) return <p className="sm mut">Pas encore assez de relevés pour tracer la courbe.</p>;
  const W = 600;
  const max = Math.max(...values) * 1.15;
  const min = Math.min(...values) * 0.7;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = height - 10 - ((v - min) / (max - min || 1)) * (height - 30);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${pts.join(" L")}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={label} preserveAspectRatio="none">
      <path d={`${line} V${height} H0z`} fill="#E8EEFD" />
      <path d={line} fill="none" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function BarChart({ data, label }: { data: { label: string; value: number; hint?: string }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="col" style={{ gap: 8 }} role="img" aria-label={label}>
      <div className="bars">
        {data.map((d, i) => (
          <i key={d.label} className={i === data.length - 1 ? "on" : ""} style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} title={d.hint ?? String(d.value)} />
        ))}
      </div>
      <div className="trl">
        {data.map((d) => (
          <span key={d.label} style={{ flex: 1, textAlign: "center" }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function LevelBadge({ level }: { level: Level }) {
  if (level === "ok") return <span className="badge b-ok"><i className="dot" /> Serein</span>;
  if (level === "warn") return <span className="badge b-warn"><i className="dot y" /> À surveiller</span>;
  return <span className="badge b-risk"><i className="dot r" /> Urgence</span>;
}

export function TierBadge({ tier }: { tier: number }) {
  return <span className={`badge ${tier === 1 ? "b-ok" : tier === 2 ? "b-warn" : "b-risk"}`}>Tranche {tier}</span>;
}

export function Empty({ icon = "plus", title, children, action }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="col" style={{ alignItems: "center", textAlign: "center", gap: 8, padding: "24px 10px" }}>
      <span className="avatar"><Icon name={icon} /></span>
      <b className="h4">{title}</b>
      {children && <span className="sm">{children}</span>}
      {action}
    </div>
  );
}
