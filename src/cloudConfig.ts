import deployment from "./cloudDeployment.json";
import { isPublicCloudKey, validCloudUrl } from "./cloudConfigValidation";
export function cloudConfig() {
  if (import.meta.env.VITE_ROOMORA_DISABLE_CLOUD === "true") return null;
  const url = (import.meta.env.VITE_SUPABASE_URL || deployment.url) as
    string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
    deployment.publishableKey) as string | undefined;
  return url && key && validCloudUrl(url) && isPublicCloudKey(key)
    ? { url, key }
    : null;
}
