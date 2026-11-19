import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Gauge } from "@/components/ui";
import { Faq, FAQ_ITEMS } from "@/components/site/SiteChrome";
import { kwhForAmount } from "@/lib/engine";
import { annualPrice, PACKS } from "@/lib/pricing";
import { fcfa, num } from "@/lib/format";
import { SLOGAN, SLOGAN_FR } from "@/lib/brand";

// Les chiffres d'exemple sont calculés par le moteur, pas écrits à la main.
const T1 = kwhForAmount(10000, { boughtMonthKwh: 0, firstRechargeOfMonth: true }).kwh;
const T2 = kwhForAmount(10000, { boughtMonthKwh: 150, firstRechargeOfMonth: false }).kwh;

const FEATURES = [
  ["wallet", "Suivi du crédit", "Votre solde en kWh et votre autonomie en jours, toujours sous les yeux."],
  ["trend", "Calcul de la consommation", "Votre moyenne par jour, calculée d'après vos relevés."],
  ["calendar", "Prévision d'épuisement", "La date estimée où votre crédit s'arrête."],
  ["calc", "Montant exact à recharger", "Minimum et recommandé pour tenir jusqu'à la fin du mois."],
  ["bell", "Alertes avant coupure", "À 5 jours, 3 jours et 1 jour, par WhatsApp, SMS ou push."],
  ["info", "Explication des tranches", "Où vous en êtes, et combien de kWh restent en tranche 1."],
  ["building", "Plusieurs compteurs", "Famille, locataires, boutique : un seul tableau de bord."],
  ["receipt", "Historique des recharges", "Date, montant, kWh, codes et revendeur pour chaque recharge."],
] as const;

export default function Home() {
  return (
    <>
      <section className="hero">
        <svg className="wm" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
        <div className="wrap" style={{ paddingTop: 72, paddingBottom: 72, display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center", position: "relative", zIndex: 1 }}>
          <div className="col hero-in" style={{ flex: "1 1 520px", gap: 24 }}>
            <span className="badge b-trial" style={{ alignSelf: "flex-start" }}><Icon name="star" size="s" /> Une solution 100 % sénégalaise</span>
            <p className="hero-slogan" lang="wo">
              {SLOGAN} <span lang="fr">· {SLOGAN_FR.toLowerCase()}</span>
            </p>
            <h1 className="h1" style={{ color: "#fff", fontSize: "clamp(36px,5vw,62px)" }}>
              Maîtrisez votre consommation d&apos;électricité <span style={{ color: "var(--yel)" }}>prépayée.</span>
            </h1>
            <p className="lead" style={{ maxWidth: 560, color: "#cfe3d8" }}>
              Woly Elec vous dit combien recharger, quand recharger et quand votre crédit Woyofal va s&apos;épuiser. Rechargez le bon montant, au bon moment, pour que votre électricité dure tout le mois.
            </p>
            <div className="row wrapf" style={{ gap: 14 }}>
              <Link className="btn btn-yel btn-lg" href="/inscription">Commencer mes 30 jours gratuits</Link>
              <Link className="btn btn-linew btn-lg" href="#fonctionnalites">En savoir plus</Link>
            </div>
            <p className="sm" style={{ color: "#9CC4B0" }}>30 jours gratuits, un compteur, sans engagement pour essayer.</p>
          </div>
          <div style={{ flex: "1 1 360px", display: "flex", justifyContent: "center" }}>
            <div className="phone-float" style={{ width: 310, height: 610, borderRadius: 44, background: "#0A1F18", padding: 9, boxShadow: "0 40px 80px rgba(0,0,0,.4)" }} aria-hidden="true">
              <div style={{ width: "100%", height: "100%", borderRadius: 36, background: "var(--bg)", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-mark.png" alt="" style={{ height: 26 }} />
                    <span className="lw" style={{ fontSize: 15 }}><b>WOLY</b><i>ELEC</i></span>
                  </span>
                  <span className="sp" />
                  <span className="badge b-trial">Essai</span>
                </div>
                <div className="col" style={{ gap: 0 }}><b className="mont ink" style={{ fontSize: 16 }}>Bonjour M. Diallo</b><span className="xs mut">Voici votre situation électrique</span></div>
                <div className="card" style={{ padding: "8px 0 6px", display: "flex", justifyContent: "center" }}>
                  <Gauge fraction={0.58} level="ok" value="41,6 kWh" detail="≈ 8 jours" size={188} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="mc" style={{ padding: 10 }}><span className="k" style={{ fontSize: 11 }}>Consommation prévue (mois)</span><span className="v" style={{ fontSize: 20 }}>156 <small>kWh</small></span></div>
                  <div className="mc" style={{ padding: 10 }}><span className="k" style={{ fontSize: 11 }}>À recharger pour finir le mois</span><span className="v" style={{ fontSize: 20 }}>4 300 <small>F</small></span></div>
                </div>
                <span className="btn btn-blue btn-blk" style={{ minHeight: 46 }}>Recharger maintenant</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec w">
        <div className="wrap col" style={{ gap: 40 }}>
          <div className="col" style={{ gap: 12, maxWidth: 760 }}>
            <span className="eyebrow">Le problème</span>
            <h2 className="h2">Pourquoi le même montant ne donne pas toujours les mêmes kWh ?</h2>
            <p className="lead">Avec Woyofal, le prix du kWh change selon vos achats du mois. Sans le savoir, on recharge trop tard, ou on perd des kWh.</p>
          </div>
          <div className="g2">
            <div className="card col" style={{ gap: 14 }}>
              <span className="badge b-ok" style={{ alignSelf: "flex-start" }}>1re recharge du mois · tranche 1</span>
              <div className="row wrapf" style={{ alignItems: "baseline", gap: 10 }}><span className="big" style={{ fontSize: "clamp(36px,5vw,56px)" }}>10 000 F</span><Icon name="arrow" /><span className="big" style={{ fontSize: "clamp(36px,5vw,56px)", color: "var(--g6)" }}>≈ {num(T1, 0)} kWh</span></div>
              <div className="tr" style={{ background: "var(--g1)" }}><b style={{ width: "92%" }} /></div>
              <p className="sm">Tranche 1 : 82 F le kWh, jusqu&apos;à 150 kWh achetés dans le mois. Taxe et redevance mensuelle incluses.</p>
            </div>
            <div className="card col" style={{ gap: 14 }}>
              <span className="badge b-warn" style={{ alignSelf: "flex-start" }}>150 kWh déjà achetés · tranche 2</span>
              <div className="row wrapf" style={{ alignItems: "baseline", gap: 10 }}><span className="big" style={{ fontSize: "clamp(36px,5vw,56px)" }}>10 000 F</span><Icon name="arrow" /><span className="big" style={{ fontSize: "clamp(36px,5vw,56px)", color: "#8A6A00" }}>≈ {num(T2, 0)} kWh</span></div>
              <div className="tr" style={{ background: "var(--g1)" }}><b style={{ width: `${(T2 / T1) * 92}%`, background: "var(--yel2)" }} /></div>
              <p className="sm">Tranche 2 : 136,49 F le kWh. Même somme, près de {Math.round((1 - T2 / T1) * 100)} % de kWh en moins. Estimations, frais inclus.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap col" style={{ gap: 40 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">En un coup d&apos;œil</span><h2 className="h2">Trois questions, trois réponses</h2></div>
          <div className="g3">
            <div className="card col" style={{ gap: 14 }}><span className="avatar b"><Icon name="clock" /></span><h3 className="h3">Combien de temps mon crédit va-t-il durer ?</h3><p className="big" style={{ fontSize: 30 }}>≈ 8 jours</p><p className="sm">Autonomie en jours et date d&apos;épuisement estimée.</p></div>
            <div className="card col" style={{ gap: 14 }}><span className="avatar b"><Icon name="calc" /></span><h3 className="h3">Combien dois-je recharger pour tenir le mois ?</h3><p className="big" style={{ fontSize: 30 }}>Minimum et recommandé</p><p className="sm">Un montant exact, frais inclus, avec une marge de sécurité.</p></div>
            <div className="card col" style={{ gap: 14 }}><span className="avatar b"><Icon name="calendar" /></span><h3 className="h3">Quel jour recharger pour avoir le plus de kWh ?</h3><p className="big" style={{ fontSize: 30 }}>Le meilleur jour</p><p className="sm">Pour éviter de payer des kWh en tranche 2 plus cher que nécessaire.</p></div>
          </div>
        </div>
      </section>

      <section className="sec w" id="fonctionnalites">
        <div className="wrap col" style={{ gap: 40 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">Fonctionnalités</span><h2 className="h2">Tout pour garder votre électricité sous contrôle</h2></div>
          <div className="g4">
            {FEATURES.map(([ic, t, d]) => (
              <div key={t} className="card flat col" style={{ gap: 12 }}><span className={`avatar${ic === "bell" ? " y" : ""}`}><Icon name={ic} /></span><b className="h4">{t}</b><p className="sm">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap col" style={{ gap: 40 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">Comment ça marche</span><h2 className="h2">De l&apos;inscription à la prévision, en cinq étapes</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 20 }}>
            {[
              ["Créez votre compte", "Téléphone et code reçu par SMS. Ajoutez votre compteur."],
              ["Saisissez 3 chiffres", "Codes 801 (solde), 814 (mois) et 813 (veille), puis votre dernière recharge."],
              ["Woly Elec calcule", "Autonomie, moyenne par jour, tranche actuelle et date de risque."],
              ["Vous êtes alerté", "Recommandations et alertes avant l'épuisement."],
              ["Vous mettez à jour", "Après chaque recharge, les prévisions deviennent plus précises."],
            ].map(([t, d], i) => (
              <div key={t} className="col" style={{ gap: 10 }}><span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}>{i + 1}</span><b className="h4">{t}</b><p className="sm">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec g">
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center" }}>
          <div className="col" style={{ flex: "1 1 420px", gap: 18 }}>
            <span className="eyebrow" style={{ color: "var(--yel)" }}>Exemple concret</span>
            <h2 className="h2" style={{ color: "#fff" }}>66 kWh restants le 17, 5,2 kWh par jour : crédit jusqu&apos;au 29.</h2>
            <p className="lead">Woly Elec fait ce calcul pour vous, à chaque relevé. Il vous dit combien recharger pour couvrir les jours qui manquent, et à quelle date.</p>
            <div className="frise" style={{ maxWidth: 560 }} aria-hidden="true">
              {Array.from({ length: 30 }, (_, i) => (
                <i key={i} className={i < 16 ? "p" : i === 16 ? "t" : i >= 28 ? "r" : ""} style={i === 16 ? { background: "var(--yel)" } : i > 16 && i < 28 ? { background: "#2f6b57" } : undefined} />
              ))}
            </div>
            <div className="fl" style={{ maxWidth: 560, color: "#9CC4B0" }}><span>1er</span><span>17 · aujourd&apos;hui</span><span>29 · fin estimée</span></div>
          </div>
          <div style={{ flex: "1 1 320px", display: "flex", justifyContent: "center" }}>
            <div className="card" style={{ padding: "22px 18px 12px" }}><Gauge fraction={0.9} level="ok" value="66 kWh" detail="≈ 12 jours" size={260} /></div>
          </div>
        </div>
      </section>

      <section className="sec w">
        <div className="wrap col" style={{ gap: 40 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">Pour qui ?</span><h2 className="h2">Un compteur, une famille ou tout un immeuble</h2></div>
          <div className="g4">
            {[["home", "Ménages", "Sachez combien recharger pour tenir jusqu'à la fin du mois."], ["building", "Propriétaires et gestionnaires", "Suivez tous vos compteurs et évitez les coupures chez vos locataires."], ["store", "Commerces et PME", "Gardez la boutique allumée, sans surprise sur le budget."], ["globe", "Diaspora", "Surveillez le compteur de la maison familiale depuis l'étranger."]].map(([ic, t, d]) => (
              <div key={t} className="card flat col" style={{ gap: 10 }}><span className="avatar"><Icon name={ic} /></span><b className="h4">{t}</b><p className="sm">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap col" style={{ gap: 40 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">Canaux d&apos;alerte</span><h2 className="h2">Prévenu là où vous lisez vos messages</h2><p className="lead">Push et WhatsApp pour les alertes, SMS pour les urgences, e-mail pour le résumé du mois.</p></div>
          <div className="g3">
            <div className="wa"><div className="m"><b>Woly Elec</b><br />Il vous reste environ 5 jours d&apos;électricité. Mettez à jour votre compteur pour recevoir votre montant exact : <Link href="/maj/k3F9">woly-elec.sn/maj/k3F9</Link><small>08:12</small></div></div>
            <div className="sms"><div className="m">Urgence : votre électricité devrait s&apos;épuiser dans environ 1 jour. Rechargez maintenant. Cliquez pour voir votre montant recommandé : woly-elec.sn/maj/k3F9</div></div>
            <div className="col" style={{ gap: 12 }}>
              <div className="push">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-icon.png" alt="" />
                <div><b>Woly Elec</b><span>Votre crédit couvre environ 3 jours. Mettez à jour votre solde.</span></div>
              </div>
              <div className="card flat row" style={{ gap: 12 }}><Icon name="mail" /><span className="sm"><b className="ink">E-mail</b> · résumé mensuel de vos recharges</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec w">
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div className="col" style={{ flex: "1 1 380px", gap: 16 }}>
            <span className="badge b-ia" style={{ alignSelf: "flex-start" }}><Icon name="sparkle" size="s" /> Woly Elec IA</span>
            <h2 className="h2">Un assistant qui explique, sans rien inventer</h2>
            <p className="lead">L&apos;IA s&apos;appuie sur vos relevés et sur le moteur de calcul. Elle explique vos recharges, commente votre bilan et vous conseille en mots simples.</p>
            <div className="tick"><Icon name="check" size="s" /><span>30 requêtes par mois et par compteur</span></div>
            <div className="tick"><Icon name="check" size="s" /><span>Les chiffres viennent de vos données, jamais d&apos;une supposition</span></div>
          </div>
          <div className="card col" style={{ flex: "1 1 420px", gap: 12, background: "var(--bg)" }}>
            <div className="chat">
              <div className="bub u">Pourquoi recharger 4 300 F pour finir le mois ?</div>
              <div className="bub a">D&apos;après vos relevés, vous consommez environ <b>5,2 kWh par jour</b>. Il vous manque environ 47 kWh pour tenir jusqu&apos;au 30 : <b>4 300 F</b> au minimum, frais inclus (estimation). Je vous conseille un peu plus, pour garder une marge.</div>
            </div>
            <span className="badge b-ia" style={{ alignSelf: "flex-start" }}>18/30 requêtes utilisées</span>
          </div>
        </div>
      </section>

      <section className="sec" id="tarifs">
        <div className="wrap col" style={{ gap: 36 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">Tarifs</span><h2 className="h2">Un SaaS peu cher, 30 jours gratuits pour essayer</h2></div>
          <div className="g2" style={{ maxWidth: 920 }}>
            {(["simple", "ia"] as const).map((k) => (
              <div key={k} className="card col" style={{ gap: 14, border: k === "ia" ? "2px solid var(--blue)" : undefined }}>
                <div className="row"><b className="h3">{PACKS[k].name}</b>{k === "ia" && <span className="badge b-ia"><Icon name="sparkle" size="s" /> IA</span>}</div>
                <p className="sm">{PACKS[k].tagline}</p>
                <p><span className="big" style={{ fontSize: 40 }}>{fcfa(PACKS[k].first)}</span> <span className="mut">/mois</span></p>
                <p className="sm">ou {fcfa(annualPrice(k, 1))}/an la 1re année</p>
                <Link className="btn btn-yel btn-blk" href="/inscription">Commencer mes 30 jours gratuits</Link>
              </div>
            ))}
          </div>
          <Link href="/tarifs" className="sm" style={{ fontWeight: 700 }}>Comparer les offres en détail →</Link>
        </div>
      </section>

      <section className="sec w">
        <div className="wrap col" style={{ gap: 36 }}>
          <div className="col" style={{ gap: 12, maxWidth: 700 }}><span className="eyebrow">Confiance</span><h2 className="h2">Des calculs que vous pouvez vérifier</h2></div>
          <div className="g4">
            {[["eye", "Calculs transparents", "Chaque chiffre est expliqué et basé sur vos relevés."], ["receipt", "Historique vérifiable", "Toutes vos recharges et relevés restent consultables."], ["shield", "Données protégées", "Vos données ne servent qu'à calculer vos prévisions."], ["info", "Service indépendant", "Woly Elec n'est pas affilié à la Senelec."]].map(([ic, t, d]) => (
              <div key={t} className="tick"><span className="avatar"><Icon name={ic} /></span><div><b className="h4">{t}</b><p className="sm">{d}</p></div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="faq">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="col" style={{ gap: 8, marginBottom: 24 }}><span className="eyebrow">FAQ</span><h2 className="h2">Questions fréquentes</h2></div>
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      <section className="sec g" style={{ textAlign: "center" }}>
        <div className="wrap col" style={{ alignItems: "center", gap: 20 }}>
          <h2 className="h2" style={{ color: "#fff", maxWidth: 760 }}>Votre électricité, tout le mois.</h2>
          <p className="lead" style={{ maxWidth: 560 }}>Ajoutez votre compteur, saisissez 3 chiffres et découvrez combien recharger.</p>
          <Link className="btn btn-yel btn-lg" href="/inscription">Commencer mes 30 jours gratuits</Link>
        </div>
      </section>
    </>
  );
}
