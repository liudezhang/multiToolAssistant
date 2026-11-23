import { describe, expect, test } from "bun:test"
import { isRequestMessage } from "../src/utils/messaging"

const backgroundSource = await Bun.file(
  new URL("../src/entrypoints/background.ts", import.meta.url)
).text()
const contentSource = await Bun.file(
  new URL("../src/entrypoints/content.ts", import.meta.url)
).text()

/** 从 handleMessage 的分支中取出全部消息类型（这是后台真正会处理的集合） */
function handledMessageTypes(source: string): string[] {
  const start = source.indexOf("async function handleMessage")
  const end = source.indexOf("unhandled: never")
  if (start < 0 || end < 0) throw new Error("handleMessage 结构变了，契约测试需要同步更新")
  return [...source.slice(start, end).matchAll(/case "([A-Z_]+)":/g)].map((match) => match[1]!)
}

const handledTypes = handledMessageTypes(backgroundSource)

describe("消息契约", () => {
  test("后台声明的消息类型不为空且不重复", () => {
    expect(handledTypes.length).toBeGreaterThan(0)
    expect(new Set(handledTypes).size).toBe(handledTypes.length)
  })

  test("后台每个分支都被 isRequestMessage 放行（漏 MESSAGE_TYPES 会导致消息被静默丢弃）", () => {
    const rejected = handledTypes.filter((type) => !isRequestMessage({ type }))
    expect(rejected).toEqual([])
  })

  test("未知消息类型会被拒绝", () => {
    expect(isRequestMessage({ type: "NOT_A_MESSAGE" })).toBe(false)
    expect(isRequestMessage({})).toBe(false)
    expect(isRequestMessage(null)).toBe(false)
    expect(isRequestMessage("GET_CREDENTIALS")).toBe(false)
  })

  test("转发给内容脚本的消息在 content script 里都有分支", () => {
    const forwarded = ["GET_STORAGE_DATA", "SET_STORAGE_DATA", "FILL_LOGIN_FORM"]
    for (const type of forwarded) {
      expect(contentSource).toContain(`message.type === "${type}"`)
    }
  })
})

describe("内容脚本启动防护（回归测试）", () => {
  test("注册监听前先检查扩展上下文是否存活", () => {
    const guardIndex = contentSource.indexOf("isExtensionContextAlive()")
    const listenerIndex = contentSource.indexOf("onMessage.addListener")
    expect(guardIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(listenerIndex)
  })

  test("注入标记在注册成功后才写入（注册失败不会把页面永久标记为已注入）", () => {
    const listenerIndex = contentSource.indexOf("onMessage.addListener")
    const flagIndex = contentSource.indexOf("window.__mtaContentInjected = true")
    expect(listenerIndex).toBeGreaterThan(-1)
    expect(flagIndex).toBeGreaterThan(listenerIndex)
  })

  test("自动捕获上报前也做上下文存活检查", () => {
    const reportBlock = contentSource.slice(
      contentSource.indexOf("function setupCredentialCapture"),
      contentSource.indexOf("/** 读取登录表单里的账号密码")
    )
    expect(reportBlock).toContain("isExtensionContextAlive()")
    expect(reportBlock).toContain("catch")
  })
})
