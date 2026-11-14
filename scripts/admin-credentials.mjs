#!/usr/bin/env node
/**
 * Génère les variables d'accès administrateur de Woly Elec.
 *   npm run admin:credentials
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

const email = (await ask("E-mail administrateur : ")).trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("E-mail invalide.");
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

console.log("\nCopiez ces 3 lignes dans les variables d'environnement du projet Docker « woly-elec » (hPanel) :\n");
console.log(`ADMIN_EMAIL=${email}`);
console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
console.log("\nEn local, collez-les dans un fichier .env.local à la racine du projet.");
