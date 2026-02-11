import dayjs from "dayjs"
import "dayjs/locale/zh-cn"
import relativeTime from "dayjs/plugin/relativeTime"
import { isPrimitive } from "es-toolkit/predicate"

dayjs.extend(relativeTime)
dayjs.locale("zh-cn")

/** 将值转为可展示字符串（对象用 JSON） */
export function formatValue(value: unknown): string {
  if (!isPrimitive(value)) return JSON.stringify(value)
  return String(value)
}

/** 相对时间格式化：刚 / N分钟前 / N小时前 / N天前 / 日期（超过 7 天显示日期） */
export function formatDate(dateString: string): string {
  const date = dayjs(dateString)
  const now = dayjs()
  if (now.diff(date, "day") >= 7) {
    return date.format("YYYY-MM-DD")
  }
  return date.fromNow()
}
