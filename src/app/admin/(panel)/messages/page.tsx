"use client";

import { useEffect, useState } from "react";
import { TEMPLATES } from "../data";
import { adminPost, SourceBadge, useAdmin } from "../useAdmin";

type Tpl = { id: string; name: string; channel: string; text: string };
type Row = { id: string; nom: string; canal: string; texte: string };

const SAMPLE: Record<string, string> = { jours: "5", lien: "wolyelec.com/app", montant: "10 000 F", kwh: "114", date: "30", recharges: "2" };
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => SAMPLE[k] ?? `{${k}}`);

export default function Messages() {
  const { data, live } = useAdmin<Row[]>("templates");
  const [items, setItems] = useState<Tpl[]>(TEMPLATES);
  const [sel, setSel] = useState(TEMPLATES[0].id);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data?.length) setItems(data.map((r) => ({ id: r.id, name: r.nom, channel: r.canal, text: r.texte })));
  }, [data]);

  const cur = items.find((t) => t.id === sel) ?? items[0];

  async function save() {
    if (!live) return setStatus({ ok: false, text: "Base non configurée : modification non enregistrée." });
    const r = await adminPost({ type: "modele", id: cur.id, texte: cur.text });
    setStatus(r.ok ? { ok: true, text: "Enregistré" } : { ok: false, text: r.error === "lien_obligatoire" ? "Le lien {lien} est obligatoire." : "Enregistrement impossible." });
  }

  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div style={{ padding: "12px 0 4px" }}><SourceBadge live={live} /></div>
        <div className="list">
          {items.map((t) => (
            <div key={t.id}>
              <button type="button" className="row" style={{ flex: 1, textAlign: "left", gap: 12, padding: "4px 0" }} onClick={() => { setSel(t.id); setStatus(null); }} aria-pressed={sel === t.id}>
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
              onChange={(e) => { setItems((xs) => xs.map((x) => (x.id === cur.id ? { ...x, text: e.target.value } : x))); setStatus(null); }}
              rows={5}
              style={{ border: "1.5px solid #C9D6CF", borderRadius: 12, padding: 14, font: "500 15px Inter", color: "var(--g9)", resize: "vertical" }}
            />
          </label>
          <span className="xs mut">Variables : {"{jours}"}, {"{lien}"}, {"{montant}"}, {"{kwh}"}, {"{date}"}, {"{recharges}"}. Chaque message doit contenir {"{lien}"}. Les modèles WhatsApp doivent être validés par Meta avant envoi.</span>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn btn-blue btn-sm" onClick={save} disabled={!cur.text.includes("{lien}")}>Enregistrer le modèle</button>
            {status && <span className={status.ok ? "badge b-ok" : "hint e"}>{status.text}</span>}
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
