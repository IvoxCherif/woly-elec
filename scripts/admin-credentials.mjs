#!/usr/bin/env node
/**
 * Génère les variables d'accès administrateur de Woly Elec (identifiant + mot de passe).
 *   node scripts/admin-credentials.mjs
 * Le mot de passe est saisi en masqué et n'est jamais affiché ni enregistré :
 * seule son empreinte scrypt est imprimée, avec un secret de session aléatoire.
 */
import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout } from "node:process";
import readline from "node:readline";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) stdout.write("\n");
      resolve(answer);
    });
  });
}

const id = (await ask("Identifiant administrateur (pseudo, 3 à 40 caractères : lettres, chiffres, . _ -) : ")).trim().toLowerCase();
if (!/^[a-z0-9._-]{3,40}$/.test(id)) {
  console.error("Identifiant invalide : 3 à 40 caractères, lettres sans accent, chiffres, point, tiret ou souligné.");
  process.exit(1);
}
const pw = await ask("Mot de passe (12 caractères minimum) : ", true);
if (pw.length < 12) {
  console.error("Mot de passe trop court : 12 caractères minimum.");
  process.exit(1);
}
const confirm = await ask("Confirmez le mot de passe : ", true);
if (pw !== confirm) {
  console.error("Les deux mots de passe ne correspondent pas.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await new Promise((res, rej) => scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));

console.log("\nDans hPanel → VPS → Docker Manager → projet « woly-elec » → Environnement,");
console.log("remplace la valeur de ces 3 variables (garde les autres telles quelles), puis redéploie :\n");
console.log(`ADMIN_EMAIL=${id}`);
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
console.log("\nNote : la variable s'appelle ADMIN_EMAIL pour des raisons historiques, mais elle contient ton identifiant.");
console.log("Connexion : https://wolyelec.com/admin/login avec cet identifiant et ce mot de passe.");
console.log("Mot de passe oublié : le code à 6 chiffres arrive dans la boîte support@wolyelec.com.");
