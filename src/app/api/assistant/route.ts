import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Assistant Woly Elec IA — Claude Sonnet 5.5 (formule Woly Elec IA, 30 requêtes par mois et par compteur).
 * Le client envoie la question et le contexte chiffré calculé par le moteur ; Claude explique sans inventer de chiffres.
 * Sans identifiants Anthropic configurés (ANTHROPIC_API_KEY…), la route répond 503 et l'interface utilise
 * la réponse locale du moteur de calcul.
 */

const SYSTEM = `Tu es l'assistant de Woly Elec, un service sénégalais indépendant (non affilié à la Senelec) qui aide les clients Woyofal (électricité prépayée) à faire durer leur crédit tout le mois.
Règles :
- Réponds en français simple, en 2 à 4 phrases, sans titres ni listes.
- N'utilise QUE les chiffres fournis dans le contexte du client. N'invente aucun chiffre, aucune date, aucun tarif. Si une information manque, dis-le et propose de faire un relevé.
- Présente les chiffres comme des estimations « d'après vos relevés ».
- Tu ne vends pas d'électricité et tu ne parles pas au nom de la Senelec.`;

export async function POST(req: Request) {
  const hasCredentials = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!hasCredentials) return NextResponse.json({ error: "assistant_non_configure" }, { status: 503 });

  let body: { question?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "requete_invalide" }, { status: 400 });
  }
  const question = (body.question ?? "").toString().slice(0, 600).trim();
  const context = (body.context ?? "").toString().slice(0, 4000);
  if (!question) return NextResponse.json({ error: "question_vide" }, { status: 400 });

  // TODO production : authentifier l'utilisateur et décompter le quota (30 requêtes/mois/compteur) côté serveur.
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `Contexte du client (calculé par le moteur Woly Elec) :\n${context}\n\nQuestion : ${question}` }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "refus" }, { status: 422 });
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return NextResponse.json({ answer: text, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "trop_de_requetes" }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "assistant_non_configure" }, { status: 503 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: "erreur_api", status: error.status }, { status: 502 });
    return NextResponse.json({ error: "erreur_reseau" }, { status: 502 });
  }
}
