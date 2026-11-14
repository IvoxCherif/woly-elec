"use client";

import { Callout, LineChart, Logo } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useMeterStats, useStore } from "@/lib/store";
import { ddmm, fcfa, monthYear, num } from "@/lib/format";

export default function Bilan() {
  const s = useMeterStats();
  const { state, today, notify } = useStore();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const readings = s.readings.filter((r) => r.date.startsWith(monthKey));
  const consumed = readings.at(-1)?.monthKwh ?? 0;
  const spent = s.monthRecharges.reduce((t, r) => t + r.amount, 0);
  const avoided = s.alerts.filter((a) => a.tone === "red" || a.tone === "warn").length > 0 && s.plan.level !== "risk" ? 1 : 0;
  const ia = state.subscription.pack === "ia";

  async function share() {
    const text = `Mon bilan Woly Elec · ${monthYear(today)} : ${num(consumed, 0)} kWh consommés, ${s.monthRecharges.length} recharges, ${fcfa(spent)}.`;
    try {
      if (navigator.share) await navigator.share({ title: "Bilan Woly Elec", text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Résumé copié dans le presse-papiers");
      }
    } catch {
      /* partage annulé */
    }
  }

  return (
    <div className="col" style={{ gap: 16, maxWidth: 820, margin: "0 auto", width: "100%" }}>
      <div className="row wrapf no-print" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="btn btn-line btn-sm" onClick={() => window.print()}>
          <Icon name="print" size="s" /> Imprimer
        </button>
        <button type="button" className="btn btn-blue btn-sm" onClick={share}>
          <Icon name="share" size="s" /> Partager
        </button>
      </div>
      <article style={{ background: "#fff", borderRadius: 6, boxShadow: "var(--sh)", padding: "clamp(24px,5vw,48px)", display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="row">
          <Logo size={40} />
          <span className="sp" />
          <div className="col" style={{ gap: 0, textAlign: "right" }}>
            <span className="lab">Bilan mensuel</span>
            <b className="mont ink" style={{ fontSize: 20 }}>{monthYear(today)}</b>
          </div>
        </div>
        <hr className="hr" />
        <div className="col" style={{ gap: 4 }}>
          <h2 className="h2" style={{ fontSize: 30 }}>Votre bilan du mois</h2>
          <span className="sm">
            {state.user.name} · {s.meter.name} · compteur {s.meter.number}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <div className="mc"><span className="k">kWh consommés</span><span className="v">{num(consumed, 0)}</span></div>
          <div className="mc"><span className="k">Recharges</span><span className="v">{s.monthRecharges.length}</span></div>
          <div className="mc"><span className="k">Dépenses</span><span className="v">{num(spent, 0)} <small>F</small></span></div>
          <div className="mc"><span className="k">Coupure évitée estimée</span><span className="v">{avoided}</span></div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          <b className="h4">Consommation du mois</b>
          <LineChart values={readings.map((r) => r.yesterdayKwh)} height={130} label="Consommation quotidienne du mois" />
        </div>
        <div className="col" style={{ gap: 0 }}>
          <b className="h4" style={{ marginBottom: 6 }}>Recharges</b>
          {s.monthRecharges.length === 0 && <span className="sm mut">Aucune recharge ce mois-ci.</span>}
          {[...s.monthRecharges].reverse().map((r) => (
            <div key={r.id} className="row sm wrapf" style={{ padding: "10px 0", borderBottom: "1px solid var(--ln)" }}>
              <span>{ddmm(r.date)} · {r.vendor}</span>
              <span className="sp" />
              <b className="ink">{fcfa(r.amount)} · {num(r.kwh, 0)} kWh · tranche {r.tier}</b>
            </div>
          ))}
        </div>
        <Callout tone="info" title={ia ? "Commentaire de l'assistant" : "À retenir"}>
          {s.tier === 1
            ? `Vous restez sous 150 kWh achetés : la tranche 1 couvre l'essentiel de votre mois. Votre moyenne est d'environ ${num(s.avg30)} kWh par jour.`
            : `Vous avez dépassé 150 kWh achetés : les derniers kWh ont coûté 136,49 F. Une recharge plus importante en début de mois garde plus de kWh en tranche 1.`}
        </Callout>
        <hr className="hr" />
        <p className="xs mut">Chiffres estimés d&apos;après vos relevés. Woly Elec est un service indépendant, non affilié à la Senelec. Une solution 100 % sénégalaise.</p>
      </article>
    </div>
  );
}
