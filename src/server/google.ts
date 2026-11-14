import "server-only";

/**
 * Connexion avec Google (OpenID Connect, flux « authorization code », client confidentiel).
 * Activée seulement si GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont définis.
 */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const googleRedirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function googleAuthUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export type GoogleProfile = { sub: string; email: string; name: string };

/**
 * Échange le code contre un jeton d'identité. Le jeton vient directement du serveur de Google (TLS),
 * on contrôle quand même l'émetteur, le destinataire, l'expiration et la vérification de l'e-mail.
 */
export async function googleProfile(origin: string, code: string): Promise<GoogleProfile | null> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) return null;
  const { id_token } = (await r.json()) as { id_token?: string };
  if (!id_token) return null;
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const issOk = c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com";
  const fresh = typeof c.exp === "number" && c.exp * 1000 > Date.now();
  if (!issOk || c.aud !== process.env.GOOGLE_CLIENT_ID || !fresh || !c.sub || !c.email || c.email_verified !== true) return null;
  return { sub: String(c.sub), email: String(c.email).toLowerCase(), name: String(c.name ?? "") };
}
