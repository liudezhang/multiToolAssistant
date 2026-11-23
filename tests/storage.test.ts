import { describe, expect, test } from "bun:test"
import { normalizeStorageItems } from "../src/utils/storage"

describe("normalizeStorageItems", () => {
  test("已是 { key, storageType } 结构时原样保留", () => {
    expect(
      normalizeStorageItems([{ key: "token", storageType: "sessionStorage" }], undefined)
    ).toEqual([{ key: "token", storageType: "sessionStorage" }])
  })

  test("缺少 storageType 时默认 localStorage", () => {
    expect(normalizeStorageItems([{ key: "token" }], undefined)).toEqual([
      { key: "token", storageType: "localStorage" },
    ])
    expect(normalizeStorageItems([{ key: "token", storageType: "" }], undefined)).toEqual([
      { key: "token", storageType: "localStorage" },
    ])
  })

  test("兼容纯字符串数组与数字", () => {
    expect(normalizeStorageItems(["a", 1], undefined)).toEqual([
      { key: "a", storageType: "localStorage" },
      { key: "1", storageType: "localStorage" },
    ])
  })

  test("旧版 keys 参数回退到 localStorage", () => {
    expect(normalizeStorageItems(undefined, ["token"])).toEqual([
      { key: "token", storageType: "localStorage" },
    ])
    expect(normalizeStorageItems([], ["token"])).toEqual([])
  })

  test("非法入参返回空数组", () => {
    expect(normalizeStorageItems(undefined, undefined)).toEqual([])
    expect(normalizeStorageItems("token", undefined)).toEqual([])
  })
})
