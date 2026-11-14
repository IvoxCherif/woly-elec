"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Câble électrique en arrière-plan du site : il serpente du haut jusqu'en bas de la page.
 * L'étincelle descend avec le défilement (elle reste vers le milieu de l'écran) et le câble se « charge »
 * en jaune derrière elle, parcouru par des impulsions. Décoratif : invisible pour les lecteurs d'écran.
 */

type Geo = { w: number; h: number; d: string };

/** Chemin en S : le câble passe d'un bord à l'autre de la page, par des courbes douces. */
function buildPath(w: number, h: number): string {
  const mobile = w < 760;
  const left = w * (mobile ? 0.05 : 0.07);
  const right = w * (mobile ? 0.95 : 0.93);
  const seg = mobile ? 520 : 760;
  const n = Math.max(2, Math.ceil(h / seg));
  const step = h / n;
  let x = w * 0.5;
  let d = `M ${x.toFixed(1)} 0`;
  for (let i = 1; i <= n; i++) {
    const nx = i === n ? w * 0.5 : i % 2 ? left : right;
    const y0 = (i - 1) * step;
    const y1 = i * step;
    d += ` C ${x.toFixed(1)} ${(y0 + step * 0.55).toFixed(1)}, ${nx.toFixed(1)} ${(y1 - step * 0.55).toFixed(1)}, ${nx.toFixed(1)} ${y1.toFixed(1)}`;
    x = nx;
  }
  return d;
}

export function ElectricCable() {
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const base = useRef<SVGPathElement>(null);
  const charged = useRef<SVGPathElement>(null);
  const maskPath = useRef<SVGPathElement>(null);
  const spark = useRef<SVGGElement>(null);
  const samples = useRef<{ len: number; y: number }[]>([]);
  const total = useRef(0);
  const [geo, setGeo] = useState<Geo | null>(null);

  // Dimensions de la page (le câble descend jusqu'en bas, pied de page compris)
  useEffect(() => {
    const parent = box.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const w = parent.clientWidth;
      const h = parent.scrollHeight;
      setGeo((g) => (g && Math.abs(g.w - w) < 2 && Math.abs(g.h - h) < 2 ? g : { w, h, d: buildPath(w, h) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [pathname]);

  const update = useCallback(() => {
    const p = base.current;
    const pts = samples.current;
    if (!p || pts.length === 0 || !box.current) return;
    // L'étincelle suit la position de lecture : environ 55 % de la hauteur de l'écran
    const top = box.current.getBoundingClientRect().top + window.scrollY;
    const target = window.scrollY + window.innerHeight * 0.55 - top;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].y < target) lo = mid + 1;
      else hi = mid;
    }
    const len = Math.max(0, Math.min(total.current, pts[lo].len));
    const dash = `${len.toFixed(1)} ${(total.current + 10).toFixed(1)}`;
    charged.current?.setAttribute("stroke-dasharray", dash);
    maskPath.current?.setAttribute("stroke-dasharray", dash);
    const pt = p.getPointAtLength(len);
    spark.current?.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
  }, []);

  // Échantillonne le chemin (longueur → hauteur) une fois dessiné
  useLayoutEffect(() => {
    const p = base.current;
    if (!p || !geo) return;
    const L = p.getTotalLength();
    total.current = L;
    const pts: { len: number; y: number }[] = [];
    for (let l = 0; l <= L; l += 6) pts.push({ len: l, y: p.getPointAtLength(l).y });
    pts.push({ len: L, y: p.getPointAtLength(L).y });
    samples.current = pts;
    update();
  }, [geo, update]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [update]);

  return (
    <div ref={box} className="cable-bg" aria-hidden="true">
      {geo && (
        <svg width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`}>
          <defs>
            <filter id="cable-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="spark-grad">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset=".35" stopColor="#FDE68A" />
              <stop offset="1" stopColor="#FACC15" stopOpacity="0" />
            </radialGradient>
            <mask id="cable-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={geo.w} height={geo.h}>
              <path ref={maskPath} d={geo.d} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeDasharray="0 99999" />
            </mask>
          </defs>
          {/* gaine du câble */}
          <path d={geo.d} fill="none" stroke="#0B3D2E" strokeOpacity=".16" strokeWidth="11" strokeLinecap="round" />
          <path ref={base} d={geo.d} fill="none" stroke="#1F7A5A" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          {/* partie chargée, du haut jusqu'à l'étincelle */}
          <path ref={charged} d={geo.d} fill="none" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" strokeDasharray="0 99999" filter="url(#cable-glow)" opacity=".85" />
          {/* impulsions électriques qui descendent dans la partie chargée */}
          <path className="cable-flow" d={geo.d} fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 34" mask="url(#cable-mask)" />
          {/* étincelle */}
          <g ref={spark} className="cable-spark">
            <circle r="22" fill="url(#spark-grad)" opacity=".75" />
            <g className="cable-rays" stroke="#FACC15" strokeWidth="2" strokeLinecap="round">
              <path d="M0 -16 L0 -26 M0 16 L0 26 M-16 0 L-26 0 M16 0 L26 0 M11 11 L18 18 M-11 -11 L-18 -18 M11 -11 L18 -18 M-11 11 L-18 18" />
            </g>
            <circle r="11" fill="#FFFFFF" opacity=".95" className="cable-core" />
            <path d="M3 -9 L-5 2 L0 2 L-3 10 L5 -2 L0 -2 Z" fill="#0B3D2E" />
          </g>
        </svg>
      )}
    </div>
  );
}
