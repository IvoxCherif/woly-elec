"use client";

import { Callout } from "@/components/ui";

/** Compte connecté sans compteur à lui et dont l'accès partagé a été retiré. */
export default function SansAcces() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/");
  }
  return (
    <div className="center col" style={{ gap: 14, maxWidth: 480 }}>
      <div className="card col" style={{ gap: 16, padding: 28 }}>
        <span className="eyebrow">Compte partagé</span>
        <h1 className="h2" style={{ fontSize: 28 }}>Vous n&apos;avez plus accès à ce compte</h1>
        <Callout tone="info" title="Que faire ?">
          Le titulaire a retiré votre accès. Demandez-lui une nouvelle invitation : elle apparaîtra dans votre boîte mail. Pour suivre votre propre compteur, écrivez à support@wolyelec.com.
        </Callout>
        <button type="button" className="btn btn-line btn-blk" onClick={() => void logout()}>Me déconnecter</button>
      </div>
    </div>
  );
}
