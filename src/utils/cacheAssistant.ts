import { omitBy } from "es-toolkit/object"
import type { StorageData } from "../types"

/** 统计有效键数量（排除 _source 元数据） */
export function getDataKeysCount(data: StorageData): number {
  return Object.keys(omitBy(data, (_, k) => String(k).endsWith("_source"))).length
}

/** 根据数据来源返回 Element Plus Tag 的 type */
export function getSourceType(
  data: StorageData,
  key: string
): "success" | "warning" | "info" {
  const source = data[`${key}_source`]
  switch (source) {
    case "localStorage":
      return "success"
    case "sessionStorage":
      return "warning"
    default:
      return "info"
  }
}

/** 根据数据来源返回展示文本 */
export function getSourceText(data: StorageData, key: string): string {
  const source = data[`${key}_source`]
  switch (source) {
    case "localStorage":
      return "localStorage"
    case "sessionStorage":
      return "sessionStorage"
    case "not_found":
      return "未找到"
    default:
      return "未知"
  }
}
