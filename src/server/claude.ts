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

export type ClaudeResult = { ok: true; text: string; model: string } | { ok: false; reason: "non_configure" | "refus" | "quota_api" | "erreur" };

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
    if (response.stop_reason === "refusal") return { ok: false, reason: "refus" };
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) return { ok: false, reason: "erreur" };
    return { ok: true, text, model: response.model };
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
