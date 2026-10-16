/** Binary MiB, displayed consistently as Mo throughout Roomora. */
export const MIB = 1024 * 1024;
export const MODEL_FILE_LIMIT = 100 * MIB;
// Embedded glTF resources grow by ~4/3 when converted to base64.
export const PREPARED_MODEL_LIMIT = 150 * MIB;
export const FURNITURE_EXPANDED_LIMIT = 200 * MIB;
export const PROJECT_ARCHIVE_LIMIT = 300 * MIB;
export const PROJECT_EXPANDED_LIMIT = 500 * MIB;
export function checkSize(bytes: number, limit: number, label: string) {
  if (bytes > limit)
    throw Error(`${label} trop volumineux (${limit / MIB} Mo maximum).`);
}
