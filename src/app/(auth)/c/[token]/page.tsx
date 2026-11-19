import Link from "next/link";
import { getDb } from "@/db";
import { Callout, Gauge } from "@/components/ui";
import { readLinkView } from "@/server/partage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Électricité partagée", robots: { index: false, follow: false } };

const fr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Lien de lecture d'un compteur (sans compte) : crédit restant et date de coupure prévue. */
export default async function LienLecture({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb().catch(() => null);
  const v = db ? await readLinkView(db, token).catch(() => null) : null;

  if (!v)
    return (
      <div className="center col" style={{ gap: 14, maxWidth: 480 }}>
        <Callout tone="warn" title="Lien inactif">Ce lien n&apos;existe pas ou a été désactivé par le titulaire du compteur.</Callout>
        <Link className="btn btn-blue" href="/">Découvrir Woly Elec</Link>
      </div>
    );

  return (
    <div className="center col" style={{ gap: 14, maxWidth: 480 }}>
      <div className="card col" style={{ gap: 14, padding: 24, alignItems: "center", textAlign: "center" }}>
        <span className="eyebrow">Électricité partagée{v.titulaire ? ` par ${v.titulaire}` : ""}</span>
        <h1 className="h3">{v.compteur} <span className="mut sm">· compteur …{v.numeroFin}</span></h1>
        {v.creditKwh === null ? (
          <Callout tone="info" title="Pas encore de relevé">Le crédit s&apos;affichera après le premier relevé.</Callout>
        ) : (
          <>
            <Gauge
              fraction={Math.min(1, (v.autonomieJours ?? 0) / 30)}
              level={v.niveau}
              value={`${v.creditKwh.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kWh`}
              detail={v.autonomieJours !== null ? `≈ ${v.autonomieJours} jour${v.autonomieJours > 1 ? "s" : ""}` : ""}
            />
            {v.coupure && <p className="sm ink">Coupure prévue vers le <b>{fr(v.coupure)}</b>, d&apos;après les relevés.</p>}
            {v.montantConseille > 0 ? (
              <Callout tone={v.niveau === "risk" ? "red" : "warn"} title={`Recharge conseillée : ${v.montantConseille.toLocaleString("fr-FR")} F`}>Pour finir le mois sans coupure.</Callout>
            ) : (
              <Callout tone="ok" title="Le crédit couvre le mois">Pas besoin de recharger avant la fin du mois.</Callout>
            )}
            {v.dernierReleve && <p className="xs mut">Dernier relevé : {fr(v.dernierReleve)} · estimations Woly Elec</p>}
          </>
        )}
      </div>
      <p className="xs mut" style={{ textAlign: "center" }}>Lecture seule. <Link href="/">Suivre mon propre compteur avec Woly Elec</Link></p>
    </div>
  );
}
