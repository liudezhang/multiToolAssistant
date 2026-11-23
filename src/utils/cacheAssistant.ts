import { omitBy } from "es-toolkit/object"
import type { StorageData } from "@/types"

/** 统计有效键数量（排除 _source 元数据） */
export function getDataKeysCount(data: StorageData): number {
  return Object.keys(omitBy(data, (_, k) => String(k).endsWith("_source"))).length
}

/** 数据来源的视觉标记：accent = localStorage，warning = sessionStorage，muted = 其它 */
export function getSourceTone(data: StorageData, key: string): "accent" | "warning" | "muted" {
  switch (data[`${key}_source`]) {
    case "localStorage":
      return "accent"
    case "sessionStorage":
      return "warning"
    default:
      return "muted"
  }
}

/** 数据来源的短标签：列表行内空间有限，用 local / session 表示 */
export function getSourceLabel(data: StorageData, key: string): string {
  switch (data[`${key}_source`]) {
    case "localStorage":
      return "local"
    case "sessionStorage":
      return "session"
    case "not_found":
      return "未找到"
    default:
      return "未知"
  }
}
