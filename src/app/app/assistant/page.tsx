"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMeterStats, useStore } from "@/lib/store";
import { contextFor, localAnswer } from "@/lib/assistant";
import { IA_QUOTA_PER_METER, PACKS } from "@/lib/pricing";

const SUGGESTIONS = ["Pourquoi recharger maintenant ?", "Combien dois-je recharger ?", "Explique-moi mon bilan", "Comment économiser ?", "Pourquoi les kWh varient ?"];

export default function Assistant() {
  const { state, askIa, notify } = useStore();
  const s = useMeterStats();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const used = state.iaUsed[s.meter.id] ?? 0;
  const ia = state.subscription.pack === "ia";

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [state.chat.length]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    if (used >= IA_QUOTA_PER_METER) return notify("Quota atteint : renouvelé le 1er du mois");
    setBusy(true);
    let answer = localAnswer(question, s);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, context: contextFor(s) }) });
      if (r.ok) {
        const j = await r.json();
        if (j.answer) answer = j.answer;
      }
    } catch {
      /* hors ligne : réponse locale */
    }
    askIa(question, answer);
    setQ("");
    setBusy(false);
  }

  if (!ia)
    return (
      <div className="center col" style={{ gap: 16 }}>
        <div className="card col" style={{ gap: 12, padding: "28px 22px", alignItems: "center", textAlign: "center", background: "var(--g9)", borderColor: "var(--g9)" }}>
          <span className="avatar" style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--blue)", color: "#fff" }}><Icon name="sparkle" size="l" /></span>
          <h2 className="mont" style={{ fontWeight: 800, fontSize: 26, color: "#fff" }}>Passez à Woly Elec IA</h2>
          <p style={{ color: "#cfe3d8" }}>{PACKS.ia.tagline}</p>
        </div>
        <div className="card col" style={{ gap: 10 }}>
          {["Recharges expliquées en mots simples", "Bilan mensuel commenté", "Conseils personnalisés", "30 requêtes par mois et par compteur", "Nombre de relances réglable"].map((t) => (
            <div key={t} className="tick sm"><Icon name="check" size="s" /><span>{t}</span></div>
          ))}
        </div>
        <Link className="btn btn-blue btn-lg" href="/app/abonnement">Passer à Woly Elec IA · 2 499 F/mois</Link>
      </div>
    );

  return (
    <div className="grid2" style={{ alignItems: "start", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))" }}>
      <div className="card col" style={{ gap: 14, minHeight: 520, gridColumn: "span 1" }}>
        <div className="chat" style={{ flex: 1 }} aria-live="polite">
          {state.chat.length === 0 && (
            <div className="bub a">
              Bonjour {state.user.name}. Je m&apos;appuie sur vos relevés et sur le moteur de calcul de Woly Elec pour vous expliquer votre crédit, vos tranches et le bon montant à recharger. Je n&apos;invente aucun chiffre.
            </div>
          )}
          {state.chat.map((m, i) => (
            <div key={i} className={`bub ${m.role}`}>{m.text}</div>
          ))}
          {busy && <div className="bub a"><span className="skel" style={{ display: "inline-block", width: 160, height: 14 }} /></div>}
          <div ref={end} />
        </div>
        <div className="chips" role="group" aria-label="Suggestions rapides">
          {SUGGESTIONS.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => send(t)} disabled={busy}>{t}</button>
          ))}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <label className="inp" style={{ flex: 1 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Posez votre question" aria-label="Votre question" maxLength={600} />
          </label>
          <button type="submit" className="avatar" style={{ width: 52, height: 52, borderRadius: 14, background: "var(--blue)", color: "#fff" }} aria-label="Envoyer" disabled={busy || !q.trim()}>
            <Icon name="send" />
          </button>
        </form>
      </div>
      <div className="col" style={{ gap: 20 }}>
        <div className="card col" style={{ gap: 8 }}>
          <div className="row"><span className="badge b-ia">{used}/{IA_QUOTA_PER_METER} requêtes ce mois-ci</span></div>
          <div className="tr" style={{ background: "var(--g1)", height: 10 }}><b style={{ width: `${(used / IA_QUOTA_PER_METER) * 100}%`, background: "var(--blue)" }} /></div>
          <span className="xs mut">Quota par compteur ({s.meter.name}) · renouvelé le 1er du mois</span>
        </div>
        <div className="card col" style={{ gap: 10, background: "var(--g1)", borderColor: "var(--g2)" }}>
          <span className="lab">Vos chiffres utilisés par l&apos;assistant</span>
          <pre className="xs" style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "Inter", color: "var(--g9)" }}>{contextFor(s)}</pre>
        </div>
        <span className="xs mut">Ces explications s&apos;appuient sur vos relevés. Aucun chiffre n&apos;est inventé. Assistant propulsé par Claude.</span>
      </div>
    </div>
  );
}
