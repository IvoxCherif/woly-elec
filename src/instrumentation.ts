/** Démarrage du serveur : la tâche planifiée (rappels de renouvellement) ne tourne que dans le runtime Node.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./instrumentation-node");
    startScheduler();
  }
}
