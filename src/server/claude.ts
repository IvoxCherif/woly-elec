import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Assistant Woly Elec IA — Claude Haiku 5.5, le modèle le moins coûteux de Claude.
 * La clé vient de la variable ANTHROPIC_API_KEY (hPanel), jamais du code.
 * Le modèle peut être changé sans modifier le code avec ANTHROPIC_MODEL.
 */
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

export const claudeEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const SYSTEM = `Tu es l'assistant de Woly Elec, un service sénégalais indépendant (non affilié à la Senelec) qui aide les clients Woyofal (électricité prépayée) à faire durer leur crédit tout le mois.
Règles :
- Réponds en français simple, en 2 à 4 phrases, sans titres ni listes.
- N'utilise QUE les chiffres fournis dans le contexte du client. N'invente aucun chiffre, aucune date, aucun tarif. Si une information manque, dis-le et propose de faire un relevé.
- Présente les chiffres comme des estimations « d'après vos relevés ».
- Pour une recharge, rappelle qu'elle s'achète chez le revendeur habituel (Wave, Orange Money, Free Money, point de vente) : Woly Elec ne vend pas d'électricité.
- Tu ne parles pas au nom de la Senelec. Pour un problème de compte ou une réclamation, oriente vers support@wolyelec.com.
- Si la question n'a rien à voir avec l'électricité, le compteur ou Woly Elec, réponds poliment que tu ne peux aider que sur ces sujets.`;

const g = globalThis as unknown as { __wolyClaude?: Anthropic };
const client = () => (g.__wolyClaude ??= new Anthropic());

/** Prix en dollars par million de tokens (Claude Haiku 5.5), modifiables par variables d'environnement. */
const PRICE_IN = Number(process.env.ANTHROPIC_PRICE_INPUT) || 0.1;
const PRICE_OUT = Number(process.env.ANTHROPIC_PRICE_OUTPUT) || 0.5;

export type ClaudeUsage = { model: string; inputTokens: number; outputTokens: number; costUsd: number };
const usageOf = (model: string, u: { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): ClaudeUsage => {
  const input = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const output = u.output_tokens ?? 0;
  return { model, inputTokens: input, outputTokens: output, costUsd: (input * PRICE_IN + output * PRICE_OUT) / 1_000_000 };
};

export type ClaudeResult =
  | { ok: true; text: string; model: string; usage: ClaudeUsage }
  | { ok: false; reason: "non_configure" | "refus" | "quota_api" | "erreur"; usage?: ClaudeUsage };

/**
 * Pose la question à Claude avec le contexte chiffré du compteur (calculé par le serveur)
 * et les derniers échanges, pour qu'il puisse répondre à « et si je recharge 5 000 F ? ».
 */
export async function askClaude(context: string, history: { role: "u" | "a"; text: string }[], question: string): Promise<ClaudeResult> {
  if (!claudeEnabled()) return { ok: false, reason: "non_configure" };

  // Derniers échanges (au plus 3 questions-réponses), en commençant par une question
  const recent = history.slice(-6);
  while (recent.length && recent[0].role !== "u") recent.shift();
  const messages: Anthropic.MessageParam[] = recent.map((m) => ({ role: m.role === "u" ? "user" : "assistant", content: m.text }));
  messages.push({ role: "user", content: `Contexte du client (calculé par le moteur Woly Elec à partir de ses relevés) :\n${context}\n\nQuestion : ${question}` });

  try {
    const response = await client().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" }, // réponses courtes : effort minimal, coût minimal
      system: SYSTEM,
      messages,
    });
    // Refus des filtres de sécurité : pas de repli serveur sur Haiku, on répond avec le moteur local
    const usage = usageOf(response.model, response.usage);
    if (response.stop_reason === "refusal") return { ok: false, reason: "refus", usage };
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) return { ok: false, reason: "erreur", usage };
    return { ok: true, text, model: response.model, usage };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("[ia] clé Anthropic refusée : vérifiez ANTHROPIC_API_KEY");
      return { ok: false, reason: "non_configure" };
    }
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "quota_api" };
    if (error instanceof Anthropic.APIError) console.error(`[ia] erreur API ${error.status}`);
    else console.error("[ia] erreur réseau", (error as Error).message);
    return { ok: false, reason: "erreur" };
  }
}

type KeyStatus = "absente" | "ok" | "refusee" | "modele_indisponible" | "injoignable";
const cache = globalThis as unknown as { __wolyClaudeStatus?: { at: number; status: KeyStatus } };

/**
 * Vérifie la clé sans consommer de tokens (lecture de la fiche du modèle), résultat gardé 10 minutes.
 * Ne révèle jamais la clé : seulement « ok », « refusee », etc.
 */
export async function claudeKeyStatus(): Promise<KeyStatus> {
  if (!claudeEnabled()) return "absente";
  const c = cache.__wolyClaudeStatus;
  if (c && Date.now() - c.at < 600_000) return c.status;
  let status: KeyStatus;
  try {
    await client().models.retrieve(CLAUDE_MODEL);
    status = "ok";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) status = "refusee";
    else if (error instanceof Anthropic.NotFoundError) status = "modele_indisponible";
    else status = "injoignable";
  }
  cache.__wolyClaudeStatus = { at: Date.now(), status };
  return status;
}

// ——— Lecture d'une photo de l'écran du compteur ———

export type PhotoReading = { valeur: number | null; code: "801" | "813" | "814" | null; lisible: boolean };
export type PhotoResult = { ok: true; reading: PhotoReading; usage: ClaudeUsage } | { ok: false; reason: "non_configure" | "refus" | "quota_api" | "erreur"; usage?: ClaudeUsage };

const PHOTO_PROMPT = `Cette photo montre l'écran d'un compteur d'électricité prépayé Woyofal (Sénégal).
Lis le nombre affiché sur l'écran (des kWh). Recopie-le exactement, avec la virgule ou le point décimal s'il y en a un ; n'invente aucun chiffre.
Si un code est visible à l'écran (801 = crédit restant, 813 = consommation de la veille, 814 = consommation du mois), indique-le, sinon code = "aucun".
Si l'écran est flou, coupé, éteint ou qu'aucun nombre n'est lisible avec certitude, mets lisible = false et valeur = 0.`;

const PHOTO_SCHEMA = {
  type: "object",
  properties: {
    lisible: { type: "boolean" },
    valeur: { type: "number" },
    code: { type: "string", enum: ["801", "813", "814", "aucun"] },
  },
  required: ["lisible", "valeur", "code"],
  additionalProperties: false,
};

/** Lit le nombre affiché sur une photo de l'écran du compteur (Claude Haiku 5.5, réponse JSON imposée). */
export async function readMeterPhoto(base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<PhotoResult> {
  if (!claudeEnabled()) return { ok: false, reason: "non_configure" };
  try {
    const response = await client().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      output_config: { effort: "low", format: { type: "json_schema", schema: PHOTO_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PHOTO_PROMPT },
          ],
        },
      ],
    });
    const usage = usageOf(response.model, response.usage);
    if (response.stop_reason === "refusal") return { ok: false, reason: "refus", usage };
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const j = JSON.parse(text) as { lisible?: boolean; valeur?: number; code?: string };
    const valeur = j.lisible && typeof j.valeur === "number" && Number.isFinite(j.valeur) && j.valeur >= 0 && j.valeur < 1_000_000 ? j.valeur : null;
    const code = j.code === "801" || j.code === "813" || j.code === "814" ? j.code : null;
    return { ok: true, reading: { valeur, code, lisible: !!j.lisible && valeur !== null }, usage };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: "non_configure" };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "quota_api" };
    if (error instanceof Anthropic.APIError) console.error(`[photo] erreur API ${error.status}`);
    else console.error("[photo] erreur", (error as Error).message);
    return { ok: false, reason: "erreur" };
  }
}
