"use client";

import { useState } from "react";
import { Callout, Switch, TextField } from "@/components/ui";
import { adminPost, useAdmin } from "../useAdmin";

type Data = { id: string | null; actif: boolean };

const ERR: Record<string, string> = {
  pixel_invalide: "L'identifiant du Pixel ne contient que des chiffres (15 à 16 en général).",
  pixel_absent: "Enregistrez d'abord l'identifiant du Pixel.",
};

/** Pixel Meta : mesure des inscriptions et des abonnements venus des publicités Facebook et Instagram. */
export default function Publicite() {
  const { data, live, reload } = useAdmin<Data>("pixel");
  const [id, setId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(body: { cle?: string; actif?: boolean }, ok: string) {
    setBusy(true);
    const r = await adminPost({ type: "pixel", ...body });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: ERR[r.error ?? ""] ?? "Enregistrement impossible." });
    if (r.ok) {
      setId("");
      void reload();
    }
  }

  if (live === false) return <Callout tone="warn" title="Base non configurée">Le Pixel s&apos;active quand la base de données est branchée.</Callout>;
  if (!data) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row wrapf" style={{ gap: 12 }}>
        <span className={`badge ${data.actif ? "b-ok" : "b-warn"}`}>{data.actif ? "Pixel actif sur le site" : "Pixel désactivé"}</span>
        <span className={`badge ${data.id ? "b-ok" : "b-risk"}`}>{data.id ? `Pixel ${data.id}` : "Aucun identifiant"}</span>
      </div>

      {msg && <Callout tone={msg.ok ? "ok" : "red"} title={msg.ok ? "C'est fait" : "Oups"}>{msg.text}</Callout>}

      <div className="card col" style={{ gap: 14 }}>
        <b className="h3">Identifiant du Pixel Meta</b>
        <p className="sm">Dans Meta Business : <b>Gestionnaire d&apos;événements</b> → <b>Sources de données</b> → votre Pixel → <b>Paramètres</b>. Copiez le numéro « ID du pixel » (ce n&apos;est pas un secret).</p>
        <TextField label="ID du Pixel" value={id} onChange={setId} placeholder={data.id ?? "123456789012345"} />
        <button type="button" className="btn btn-blue" disabled={busy || !id.trim()} onClick={() => void save({ cle: id }, "Identifiant enregistré.")}>Enregistrer</button>
        <Switch checked={data.actif} onChange={(v) => void save({ actif: v }, v ? "Pixel activé : il se charge chez les visiteurs qui acceptent les cookies de mesure." : "Pixel désactivé : plus rien n'est envoyé à Meta.")} label="Activer le Pixel sur wolyelec.com" />
      </div>

      <div className="card col" style={{ gap: 8 }}>
        <b className="h3">Événements envoyés à Meta</b>
        <ul className="sm" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li><b>PageView</b> : chaque page visitée (site et espace client).</li>
          <li><b>CompleteRegistration</b> et <b>StartTrial</b> : compte créé, essai gratuit de 30 jours lancé.</li>
          <li><b>Purchase</b> et <b>Subscribe</b> : abonnement payé, avec le montant en F CFA.</li>
        </ul>
        <p className="xs mut">Pour votre campagne, choisissez l&apos;objectif « Prospects » ou « Ventes » et l&apos;événement <b>CompleteRegistration</b> (ou <b>Purchase</b> dès que vous avez une vingtaine d&apos;abonnements par semaine).</p>
      </div>

      <Callout tone="info" title="Vie privée">
        Le Pixel ne se charge qu&apos;après l&apos;accord du visiteur dans le bandeau « Cookies de mesure ». Il n&apos;est jamais chargé dans l&apos;administration ni sur les liens de lecture partagés. Aucun relevé, numéro de compteur ou code de recharge n&apos;est envoyé à Meta.
      </Callout>
    </div>
  );
}
