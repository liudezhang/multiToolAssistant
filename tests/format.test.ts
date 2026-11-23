import { describe, expect, test } from "bun:test"
import { formatDate, formatValue } from "../src/utils/format"

describe("formatValue", () => {
  test("原始类型直接转字符串", () => {
    expect(formatValue("abc")).toBe("abc")
    expect(formatValue(0)).toBe("0")
    expect(formatValue(false)).toBe("false")
    expect(formatValue(null)).toBe("null")
  })

  test("对象与数组走 JSON", () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}')
    expect(formatValue([1, 2])).toBe("[1,2]")
  })
})

describe("formatDate", () => {
  test("超过 7 天显示具体日期", () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatDate(old)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test("7 天内显示相对时间", () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const text = formatDate(recent)
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
