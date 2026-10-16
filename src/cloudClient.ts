import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudConfig } from "./cloudConfig";
let client: Promise<SupabaseClient> | undefined;
export function cloudClient() {
  const config = cloudConfig();
  if (!config)
    throw Error("La sauvegarde en ligne n’est pas encore activée sur ce site.");
  return (client ||= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  ));
}
export function cloudError(e: unknown): string {
  const text =
    e instanceof Error
      ? e.message
      : (e as { message?: string })?.message || "Service indisponible.";
  if (/invalid login credentials/i.test(text))
    return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(text))
    return "Confirmez votre adresse avec le lien reçu par e-mail.";
  if (/rate|too many/i.test(text))
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (/quota|exceeded|maximum.*size/i.test(text))
    return "Le quota de stockage en ligne est atteint. Votre copie locale est conservée.";
  if (/fetch|network|offline/i.test(text))
    return "Connexion indisponible. Vos modifications restent sauvegardées sur cet appareil.";
  if (/relation.*does not exist|bucket not found/i.test(text))
    return "Le stockage en ligne doit encore être configuré par l’administrateur du site.";
  return text;
}
