/**
 * Identifiant de connexion de l'administrateur (pseudo).
 * Lu dans ADMIN_USERNAME, sinon dans ADMIN_EMAIL (nom historique de la variable, conservé pour ne pas
 * reconfigurer le serveur : elle peut contenir un pseudo). Comparaison sans casse ni espaces autour.
 */
export const adminIdentifier = (): string | null => {
  const v = (process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  return v || null;
};

export const isAdminIdentifier = (given: unknown): boolean => {
  const id = adminIdentifier();
  return !!id && String(given ?? "").trim().toLowerCase() === id;
};
