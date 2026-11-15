"use client";

import { useState } from "react";
import { Callout, Empty, NumField, TextField } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useMeterStats, useStore } from "@/lib/store";
import { applianceKwhPerDay } from "@/lib/engine";
import { fcfa, num, parseNum } from "@/lib/format";

const ICONS: Record<string, string> = { réfrigérateur: "fridge", congélateur: "fridge", climatiseur: "wind", ventilateur: "wind", télévision: "tv", éclairage: "bulb", lampe: "bulb" };
const iconFor = (n: string) => ICONS[n.toLowerCase()] ?? "plug";
const PRESETS = [
  { name: "Climatiseur", watts: 1000, h: 6 },
  { name: "Congélateur", watts: 200, h: 12 },
  { name: "Fer à repasser", watts: 1200, h: 0.5 },
  { name: "Chauffe-eau", watts: 1500, h: 1 },
  { name: "Ordinateur", watts: 60, h: 6 },
  { name: "Pompe à eau", watts: 750, h: 1 },
];

export default function Appareils() {
  const { state, addAppliance, removeAppliance, notify } = useStore();
  const s = useMeterStats();
  const [name, setName] = useState("");
  const [watts, setWatts] = useState("");
  const [hours, setHours] = useState("");
  const [dpw, setDpw] = useState("7");

  const list = state.appliances.map((a) => ({ ...a, k: applianceKwhPerDay(a) })).sort((a, b) => b.k - a.k);
  const total = list.reduce((t, a) => t + a.k, 0);
  const real = s.avg30 || s.avg7;
  const max = Math.max(total, real, 0.1);
  const top = list[0];
  const price = s.tier === 1 ? 82 : 136.49;
  const w = parseNum(watts), h = parseNum(hours), d = parseNum(dpw);
  const valid = name.trim() && w > 0 && h > 0 && h <= 24 && d >= 1 && d <= 7;

  function add() {
    if (!valid) return;
    addAppliance({ name: name.trim(), watts: w, hoursPerDay: h, daysPerWeek: d });
    notify(`${name.trim()} ajouté`);
    setName(""); setWatts(""); setHours(""); setDpw("7");
  }

  return (
    <>
      <p className="lead" style={{ maxWidth: 760 }}>
        Déclarez vos appareils pour savoir lesquels pèsent le plus. Estimation : watts × heures par jour ÷ 1 000. Woly Elec ne peut pas identifier vos appareils à partir du compteur seul : ces chiffres restent indicatifs.
      </p>
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card" style={{ padding: "4px 20px" }}>
          {list.length === 0 ? (
            <Empty icon="plug" title="Aucun appareil déclaré">Ajoutez votre réfrigérateur, climatiseur, télévision…</Empty>
          ) : (
            <div className="list">
              {list.map((a) => (
                <div key={a.id}>
                  <span className="avatar y"><Icon name={iconFor(a.name)} size="s" /></span>
                  <div className="fx1">
                    <b className="ink">{a.name}</b>
                    <div className="xs mut">{num(a.watts, 0)} W · {num(a.hoursPerDay)} h/jour{a.daysPerWeek < 7 ? ` · ${a.daysPerWeek} j/sem.` : ""} · ≈ {fcfa(a.k * 30 * price)}/mois</div>
                  </div>
                  <b className="mont ink">{num(a.k)} <small>kWh/j</small></b>
                  <button type="button" className="avatar" style={{ background: "transparent" }} onClick={() => removeAppliance(a.id)} aria-label={`Supprimer ${a.name}`}>
                    <Icon name="trash" size="s" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 20 }}>
          <div className="card col" style={{ gap: 10 }}>
            <span className="lab">Estimé vs réel</span>
            <div className="row"><span className="sm" style={{ width: 70 }}>Estimé</span><div className="tr" style={{ flex: 1, background: "var(--g1)" }}><b style={{ width: `${(total / max) * 100}%`, background: "var(--yel2)" }} /></div><b className="ink sm">{num(total)}</b></div>
            <div className="row"><span className="sm" style={{ width: 70 }}>Réel</span><div className="tr" style={{ flex: 1, background: "var(--g1)" }}><b style={{ width: `${(real / max) * 100}%`, background: "var(--blue)" }} /></div><b className="ink sm">{num(real)}</b></div>
            <span className="xs mut">kWh par jour · estimation d&apos;après vos appareils et vos relevés</span>
            {real > 0 && (
              <p className="sm">
                {Math.abs(total - real) / real < 0.15
                  ? "Vos appareils déclarés expliquent bien votre consommation."
                  : total < real
                    ? `Environ ${num(real - total)} kWh par jour ne sont pas expliqués : un appareil manque peut-être à la liste.`
                    : "Vos durées d'utilisation semblent surestimées par rapport à votre compteur."}
              </p>
            )}
          </div>
          {top && total > 0 && (
            <Callout tone="info" icon="bulb" title="Plus gros consommateur">
              {top.name} : environ {Math.round((top.k / total) * 100)} % de la consommation déclarée, soit ≈ {fcfa(top.k * 30 * price)} par mois au tarif actuel.
            </Callout>
          )}
          <div className="card col" style={{ gap: 12 }}>
            <b className="h3">Ajouter un appareil</b>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" className="chip" onClick={() => { setName(p.name); setWatts(String(p.watts)); setHours(String(p.h).replace(".", ",")); }}>{p.name}</button>
              ))}
            </div>
            <TextField label="Nom" value={name} onChange={setName} placeholder="Climatiseur du salon" />
            <div className="grid3f">
              <NumField big={false} label="Puissance" unit="W" value={watts} onChange={setWatts} />
              <NumField big={false} label="Heures / jour" unit="h" value={hours} onChange={setHours} />
              <NumField big={false} label="Jours / semaine" unit="j" value={dpw} onChange={setDpw} />
            </div>
            {valid && <span className="sm">≈ <b className="ink">{num(applianceKwhPerDay({ watts: w, hoursPerDay: h, daysPerWeek: d }))} kWh par jour</b></span>}
            <button type="button" className="btn btn-blue" disabled={!valid} onClick={add}><Icon name="plus" size="s" /> Ajouter</button>
          </div>
        </div>
      </div>
    </>
  );
}
