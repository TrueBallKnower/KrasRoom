/** Only keys intended for public browser use may enter a static build. */
export function isPublicCloudKey(key: string) {
  if (key.startsWith("sb_publishable_") && key.length > 15) return true;
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    return (
      JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))).role ===
      "anon"
    );
  } catch {
    return false;
  }
}
export function validCloudUrl(url: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      (u.pathname === "/" || u.pathname === "")
    );
  } catch {
    return false;
  }
}
