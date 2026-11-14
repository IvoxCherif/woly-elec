"use client";

import { useState } from "react";
import { TEMPLATES } from "../data";

const SAMPLE: Record<string, string> = { jours: "5", lien: "woly-elec.sn/maj/k3F9", montant: "10 000 F", kwh: "114", date: "30", recharges: "2" };
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => SAMPLE[k] ?? `{${k}}`);

export default function Messages() {
  const [items, setItems] = useState(TEMPLATES);
  const [sel, setSel] = useState(TEMPLATES[0].id);
  const [saved, setSaved] = useState(false);
  const cur = items.find((t) => t.id === sel)!;

  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div className="list">
          {items.map((t) => (
            <div key={t.id}>
              <button type="button" className="row" style={{ flex: 1, textAlign: "left", gap: 12, padding: "4px 0" }} onClick={() => { setSel(t.id); setSaved(false); }} aria-pressed={sel === t.id}>
                <span className={`avatar${sel === t.id ? " b" : ""}`}>{t.name.match(/\d/)?.[0] ?? "✉"}</span>
                <span style={{ flex: 1 }}><b className="ink">{t.name}</b><span className="xs mut" style={{ display: "block" }}>{t.channel}</span></span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="col" style={{ gap: 20 }}>
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">{cur.name}</b>
          <label className="field">
            <span className="lbl">Texte du message</span>
            <textarea
              value={cur.text}
              onChange={(e) => { setItems((xs) => xs.map((x) => (x.id === sel ? { ...x, text: e.target.value } : x))); setSaved(false); }}
              rows={5}
              style={{ border: "1.5px solid #C9D6CF", borderRadius: 12, padding: 14, font: "500 15px Inter", color: "var(--g9)", resize: "vertical" }}
            />
          </label>
          <span className="xs mut">Variables : {"{jours}"}, {"{lien}"}, {"{montant}"}, {"{kwh}"}, {"{date}"}, {"{recharges}"}. Chaque message doit contenir {"{lien}"} : un lien personnel, signé et expirable. Les modèles WhatsApp doivent être validés par Meta avant envoi.</span>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn btn-blue btn-sm" onClick={() => setSaved(true)} disabled={!cur.text.includes("{lien}")}>Enregistrer le modèle</button>
            {saved && <span className="badge b-ok">Enregistré</span>}
            {!cur.text.includes("{lien}") && <span className="hint e">Le lien {"{lien}"} est obligatoire.</span>}
          </div>
        </div>
        <div className="card col" style={{ gap: 10 }}>
          <span className="lab">Aperçu WhatsApp</span>
          <div className="wa"><div className="m"><b>Woly Elec</b><br />{fill(cur.text)}<small>08:12</small></div></div>
          <span className="lab">Aperçu SMS · {fill(cur.text).length} caractères{fill(cur.text).length > 160 ? ` (${Math.ceil(fill(cur.text).length / 153)} SMS)` : ""}</span>
          <div className="sms"><div className="m">{fill(cur.text)}</div></div>
        </div>
      </div>
    </div>
  );
}
