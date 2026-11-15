/** Marque « admin ouvert » de l'onglet ou de l'appli WE Admin : effacée à chaque fermeture (sessionStorage). */
export const ADMIN_UNLOCK = "we-admin-ouvert";

export function markAdminUnlocked() {
  try {
    sessionStorage.setItem(ADMIN_UNLOCK, "1");
  } catch {
    /* stockage indisponible : les identifiants seront redemandés */
  }
}
