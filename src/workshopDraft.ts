import { openDB } from "idb";
import { validateDesign, type Design } from "./workshopDesign";
const db = () =>
  openDB("krasroom-workshop", 1, {
    upgrade(d) {
      d.createObjectStore("drafts");
    },
  });
export async function loadDesignDraft(): Promise<Design | undefined> {
  const d = await db();
  try {
    const value = await d.get("drafts", "current");
    if (value !== undefined) validateDesign(value);
    return value;
  } finally {
    d.close();
  }
}
export async function saveDesignDraft(value: Design) {
  validateDesign(value);
  const d = await db();
  try {
    await d.put("drafts", value, "current");
  } finally {
    d.close();
  }
}
