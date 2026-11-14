"use client";

import { useState } from "react";
import { Callout, Modal, NumField, Switch, TextField } from "../ui";
import { Icon } from "../Icon";
import { useMeterStats, useStore } from "@/lib/store";
import { fcfa, isoDate, kwh, parseNum } from "@/lib/format";
import { kwhForAmount } from "@/lib/engine";

/** Saisie rapide d'un relevé : codes 801, 813, 814 (maquette « Saisie rapide d'un relevé »). */
export function ReleveModal({ open, onClose, onRecharge }: { open: boolean; onClose: () => void; onRecharge: () => void }) {
  const { meter, today, addReading, notify } = useStore();
  const s = useMeterStats();
  const [bal, setBal] = useState("");
  const [veille, setVeille] = useState("");
  const [mois, setMois] = useState("");
  const [date, setDate] = useState(isoDate(today));
  const [recharged, setRecharged] = useState(false);
  const [tried, setTried] = useState(false);

  const b = parseNum(bal);
  const v = parseNum(veille);
  const m = parseNum(mois);
  const errB = tried && !(b >= 0) ? "Saisissez le solde affiché par le code 801." : undefined;
  const errV = tried && !(v >= 0) ? "Saisissez la consommation de la veille (code 813)." : v > 0 && s.avg7 > 0 && (v < s.avg7 * 0.15 || v > s.avg7 * 3.5) ? "Cette valeur semble inhabituelle, vérifiez." : undefined;
  const errM = tried && !(m >= 0) ? "Saisissez la consommation du mois (code 814)." : s.last && m >= 0 && m < s.last.monthKwh && new Date(date).getDate() > 1 && new Date(s.last.date).getMonth() === new Date(date).getMonth() ? "Plus bas que le relevé précédent : vérifiez." : undefined;

  function save() {
    setTried(true);
    if (!(b >= 0 && v >= 0 && m >= 0)) return;
    addReading({ meterId: meter.id, date, balanceKwh: b, yesterdayKwh: v, monthKwh: m });
    notify("Relevé enregistré");
    setBal("");
    setVeille("");
    setMois("");
    setTried(false);
    if (recharged) onRecharge();
    else onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau relevé" subtitle={`${meter.name} · ${meter.number}`}>
      <div className="grid3f">
        <NumField label="Solde · 801" unit="kWh" value={bal} onChange={setBal} error={errB} autoFocus placeholder={s.last ? String(s.last.balanceKwh).replace(".", ",") : "0"} />
        <NumField label="Veille · 813" unit="kWh" value={veille} onChange={setVeille} error={errV} placeholder={s.last ? String(s.last.yesterdayKwh).replace(".", ",") : "0"} />
        <NumField label="Mois · 814" unit="kWh" value={mois} onChange={setMois} error={errM} placeholder={s.last ? String(s.last.monthKwh) : "0"} />
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", alignItems: "end", gap: 12 }}>
        <div className="field">
          <label htmlFor="rel-date">Date du relevé</label>
          <div className="inp">
            <input id="rel-date" type="date" value={date} max={isoDate(today)} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ minHeight: 52 }}>
          <Switch checked={recharged} onChange={setRecharged} label="J'ai rechargé depuis" />
        </div>
      </div>
      <Callout tone="info" title="Estimation d'après vos relevés">
        Tapez le code sur le clavier du compteur et recopiez la valeur affichée. Les résultats se mettent à jour dès l&apos;enregistrement.
      </Callout>
      <div className="row wrapf" style={{ justifyContent: "flex-end", gap: 12 }}>
        <button type="button" className="btn btn-line" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn btn-blue" onClick={save}>
          {recharged ? "Enregistrer et saisir la recharge" : "Enregistrer et voir mon montant"}
        </button>
      </div>
    </Modal>
  );
}

const VENDORS = ["Wave", "Orange Money", "Free Money", "Point de vente", "Senelec en ligne"];

/** Enregistrer une recharge : date, montant, kWh reçus, 3 codes de 20 chiffres, revendeur. */
export function RechargeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { meter, today, addRecharge, notify } = useStore();
  const s = useMeterStats();
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [vendor, setVendor] = useState("Wave");
  const [date, setDate] = useState(isoDate(today));
  const [tokens, setTokens] = useState(["", "", ""]);
  const a = parseNum(amount);
  const est = a > 0 ? kwhForAmount(a, { boughtMonthKwh: s.boughtMonthKwh, firstRechargeOfMonth: s.firstRechargeOfMonth, phase: meter.phase, debt: meter.debt }) : null;

  function save() {
    if (!(a > 0)) return;
    const r = parseNum(received);
    const rec = addRecharge({ meterId: meter.id, date, amount: a, vendor, tokens: tokens.map((t) => t.replace(/\D/g, "")).filter(Boolean), kwh: r > 0 ? r : undefined });
    notify(`Recharge enregistrée : ${fcfa(a)} · ${kwh(rec.kwh, 0)}`);
    setAmount("");
    setReceived("");
    setTokens(["", "", ""]);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Enregistrer une recharge" subtitle={`${meter.name} · ${meter.number}`}>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <NumField label="Montant rechargé" unit="F" value={amount} onChange={setAmount} autoFocus placeholder="10 000" />
        <NumField label="kWh reçus (sur le ticket)" unit="kWh" value={received} onChange={setReceived} placeholder={est ? String(Math.round(est.kwh)) : "—"} hint={est ? `Estimé : ≈ ${kwh(est.kwh)}` : undefined} />
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        <div className="field">
          <label htmlFor="rc-date">Date</label>
          <div className="inp">
            <input id="rc-date" type="date" value={date} max={isoDate(today)} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="rc-vendor">Revendeur</label>
          <div className="inp">
            <select id="rc-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
              {VENDORS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <Icon name="down" size="s" />
          </div>
        </div>
      </div>
      <div className="col" style={{ gap: 8 }}>
        <span className="lbl">Codes de recharge (3 codes de 20 chiffres, facultatif)</span>
        {tokens.map((t, i) => (
          <TextField key={i} label={`Code ${i + 1}`} value={t} onChange={(v) => setTokens((x) => x.map((y, j) => (j === i ? v.replace(/[^\d\s]/g, "").slice(0, 24) : y)))} placeholder="0000 0000 0000 0000 0000" />
        ))}
      </div>
      {est && (
        <Callout tone="info" title={`≈ ${kwh(est.kwh)} estimés`}>
          Taxe communale {fcfa(est.tax)}
          {est.redevance > 0 ? ` · redevance mensuelle ${fcfa(est.redevance)} (1re recharge du mois)` : ""} ·{" "}
          {est.parts.map((p) => `${kwh(p.kwh)} en tranche ${p.tier}`).join(", ")}.
        </Callout>
      )}
      <div className="row wrapf" style={{ justifyContent: "flex-end", gap: 12 }}>
        <button type="button" className="btn btn-line" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn btn-blue" onClick={save} disabled={!(a > 0)}>
          Enregistrer la recharge
        </button>
      </div>
    </Modal>
  );
}
