import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import deployment from "./src/cloudDeployment.json";
import { isPublicCloudKey, validCloudUrl } from "./src/cloudConfigValidation";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_"),
    url = env.VITE_SUPABASE_URL || deployment.url,
    key = env.VITE_SUPABASE_ANON_KEY || deployment.publishableKey;
  if (key && !isPublicCloudKey(key))
    throw Error(
      "Clé Supabase refusée : utilisez uniquement une clé publique Publishable ou anon, jamais une clé privée.",
    );
  if (url && !validCloudUrl(url))
    throw Error(
      "URL Supabase invalide : utilisez l’URL HTTPS publique du projet.",
    );
  if (Boolean(url) !== Boolean(key))
    throw Error(
      "La configuration Supabase doit contenir l’URL et sa clé publique, ou rester entièrement vide.",
    );
  return {
    plugins: [react()],
    base: "./",
    optimizeDeps: { include: ["three/examples/jsm/exporters/GLTFExporter.js"] },
  };
});
