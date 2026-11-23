import { describe, expect, test } from "bun:test"
import { getDataKeysCount, getSourceLabel, getSourceTone } from "../src/utils/cacheAssistant"

const data = {
  token: "abc",
  token_source: "localStorage",
  userinfo: { name: "x" },
  userinfo_source: "sessionStorage",
  missing: null,
  missing_source: "not_found",
}

describe("getDataKeysCount", () => {
  test("统计有效键时排除 _source 元数据", () => {
    expect(getDataKeysCount(data)).toBe(3)
  })

  test("空数据返回 0", () => {
    expect(getDataKeysCount({})).toBe(0)
  })
})

describe("getSourceLabel / getSourceTone", () => {
  test("localStorage / sessionStorage / not_found 的标签与色调", () => {
    expect(getSourceLabel(data, "token")).toBe("local")
    expect(getSourceTone(data, "token")).toBe("accent")

    expect(getSourceLabel(data, "userinfo")).toBe("session")
    expect(getSourceTone(data, "userinfo")).toBe("warning")

    expect(getSourceLabel(data, "missing")).toBe("未找到")
    expect(getSourceTone(data, "missing")).toBe("muted")
  })

  test("没有来源元数据时回退到未知", () => {
    expect(getSourceLabel({}, "whatever")).toBe("未知")
    expect(getSourceTone({}, "whatever")).toBe("muted")
  })
})
