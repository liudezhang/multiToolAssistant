import { isPlainObject } from "es-toolkit/predicate"

/** 将 items/keys 参数统一为 { key, storageType }[] 格式 */
export function normalizeStorageItems(
  items: unknown,
  keys: unknown
): { key: string; storageType?: string }[] {
  if (Array.isArray(items)) {
    return items.map((item) =>
      isPlainObject(item) && "key" in item
        ? {
            key: String((item as { key: string }).key),
            storageType: (item as { storageType?: string }).storageType || "localStorage",
          }
        : { key: String(item), storageType: "localStorage" }
    )
  }
  if (Array.isArray(keys)) {
    return keys.map((k) => ({ key: String(k), storageType: "localStorage" as const }))
  }
  return []
}
