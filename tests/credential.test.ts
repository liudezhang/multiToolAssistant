import { describe, expect, test } from "bun:test"
import { getPrimaryDomain, maskPassword } from "../src/utils/credential"

describe("getPrimaryDomain", () => {
  test("二级域直接返回", () => {
    expect(getPrimaryDomain("example.com")).toBe("example.com")
  })

  test("多级子域归并到主域（同一个项目的账号聚合在一起）", () => {
    expect(getPrimaryDomain("admin.example.com")).toBe("example.com")
    expect(getPrimaryDomain("a.b.example.com")).toBe("example.com")
  })

  test("同名账号不同子域得到同一主域，但 hostname 不同", () => {
    const hosts = ["a.example.com", "b.example.com"]
    expect(new Set(hosts.map(getPrimaryDomain))).toEqual(new Set(["example.com"]))
  })

  test("localhost 与 IP 原样返回", () => {
    expect(getPrimaryDomain("localhost")).toBe("localhost")
    expect(getPrimaryDomain("127.0.0.1")).toBe("127.0.0.1")
    expect(getPrimaryDomain("[::1]")).toBe("[::1]")
  })

  test("空值返回空串", () => {
    expect(getPrimaryDomain("")).toBe("")
  })

  test("已知限制：多级公共后缀会被判错（行为固定，改动需显式确认）", () => {
    expect(getPrimaryDomain("a.example.co.uk")).toBe("co.uk")
    expect(getPrimaryDomain("a.example.com.cn")).toBe("com.cn")
  })
})

describe("maskPassword", () => {
  test("固定长度，不暴露真实密码长度", () => {
    expect(maskPassword("a")).toBe("••••••••")
    expect(maskPassword("a-very-long-password")).toBe("••••••••")
  })

  test("空密码给出明确提示", () => {
    expect(maskPassword("")).toBe("（未填写）")
  })
})
