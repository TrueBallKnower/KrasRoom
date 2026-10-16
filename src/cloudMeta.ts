import { openDB } from "idb";
import type { CloudAsset } from "./cloudDocument";
export type CloudLink = { revision: string; fingerprint: string };
const db = () =>
  openDB("roomora-cloud", 1, {
    upgrade(d) {
      d.createObjectStore("links");
      d.createObjectStore("assets");
    },
  });
export async function cloudLink(
  user: string,
  id: string,
): Promise<CloudLink | undefined> {
  return (await db()).get("links", `${user}/${id}`);
}
export async function putCloudLink(user: string, id: string, link: CloudLink) {
  await (await db()).put("links", link, `${user}/${id}`);
}
export async function cachedCloudAsset(
  user: string,
  id: string,
): Promise<CloudAsset | undefined> {
  return (await db()).get("assets", `${user}/${id}`);
}
export async function cacheCloudAsset(
  user: string,
  id: string,
  value: CloudAsset,
) {
  await (await db()).put("assets", value, `${user}/${id}`);
}
