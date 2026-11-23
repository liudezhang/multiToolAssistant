/**
 * 内容脚本 - 注入到所有网页
 * 在页面上下文中读写 localStorage / sessionStorage
 * 由 background 通过 tabs.sendMessage 调用
 */
import { browser } from "wxt/browser"
import { normalizeStorageItems } from "@/utils/storage"

/** storage 数据的来源元数据后缀：`<key>_source` 记录该键来自哪个 storage */
const SOURCE_SUFFIX = "_source"

type StorageTarget = "localStorage" | "sessionStorage"

interface StorageEntry {
  value: unknown
  source: StorageTarget | "not_found"
}

declare global {
  interface Window {
    /** 标记内容脚本是否已注册监听，避免 background 重试注入时重复注册 */
    __mtaContentInjected?: boolean
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  main() {
    // 扩展重载 / 更新后，已注入页面的旧上下文里 runtime 会变成 undefined，
    // 此时注册监听必然抛错并让 WXT 报 “crashed on startup”，直接跳过即可
    if (!isExtensionContextAlive()) return
    // background 在 sendMessage 失败时会重新注入本脚本，重复注册会导致一次请求收到多个响应
    if (window.__mtaContentInjected) return

    try {
      // 监听来自 background 的消息
      browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === "GET_STORAGE_DATA") {
          const items = normalizeStorageItems(message.items, message.keys)
          const results = getStorageData(items)
          sendResponse(results)
          return true
        }

        if (message.type === "SET_STORAGE_DATA") {
          const results = setStorageData(message.data)
          sendResponse(results)
          return true
        }

        if (message.type === "FILL_LOGIN_FORM") {
          sendResponse(fillLoginForm(message.username, message.password))
          return true
        }
      })
    } catch (error) {
      // 上下文在检查后失效的情况：静默退出，等页面刷新后重新注入
      console.warn("多工具助手内容脚本注册失败:", error)
      return
    }

    // 注册成功后才打标记，避免注册失败时把页面永久标记为「已注入」
    window.__mtaContentInjected = true
    console.log("多工具助手内容脚本已注入")

    setupCredentialCapture()
  },
})

/** 判断扩展上下文是否仍可用（重载 / 更新 / 卸载后 runtime 会消失） */
function isExtensionContextAlive(): boolean {
  try {
    return Boolean(browser.runtime?.id)
  } catch {
    return false
  }
}

/** 自动捕获：用户提交登录表单时上报账号密码，是否落库由 background 的开关与去重规则决定 */
function setupCredentialCapture() {
  const report = (credentials: { username: string; password: string } | null) => {
    // 上下文失效后仍会收到 DOM 事件，此时不能再碰 runtime
    if (!credentials || !isExtensionContextAlive()) return
    try {
      void browser.runtime.sendMessage({ type: "CAPTURE_CREDENTIAL", ...credentials }).catch(() => {})
    } catch {
      /* 上下文已失效，静默丢弃这次捕获 */
    }
  }

  document.addEventListener(
    "submit",
    (event) => {
      if (!(event.target instanceof HTMLFormElement)) return
      report(readLoginCredentials(event.target))
    },
    true
  )

  // SPA 常以「按钮 + XHR」代替表单提交，补一条无 form 的点击路径
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return
      const button = event.target.closest("button, input[type=submit], [role=button]")
      if (!button || button.closest("form")) return
      report(readLoginCredentials())
    },
    true
  )
}

/** 读取登录表单里的账号密码；页面上存在多个密码框时（注册 / 改密码）不当作登录凭据 */
function readLoginCredentials(scope?: ParentNode): { username: string; password: string } | null {
  const root: ParentNode = scope ?? document
  const passwordInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[type="password"]'),
  ].filter(isEditableInput)
  if (passwordInputs.length !== 1) return null

  const inputs = findLoginInputs(root)
  const username = inputs.username?.value.trim() ?? ""
  const password = inputs.password?.value ?? ""
  if (!username || !password) return null
  return { username, password }
}

/** 设置输入框的值并触发 input/change；直接赋值会被 React 的 value tracker 吞掉，需走原型 setter */
function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

function isEditableInput(input: HTMLInputElement): boolean {
  return !input.disabled && !input.readOnly && input.getClientRects().length > 0
}

/** 寻找登录表单：以可见的密码框为锚点，取它前面最近的文本/邮箱输入作为账号框 */
function findLoginInputs(
  scope?: ParentNode
): { username?: HTMLInputElement; password?: HTMLInputElement } {
  const root: ParentNode = scope ?? document
  const password = [...root.querySelectorAll<HTMLInputElement>('input[type="password"]')].find(
    isEditableInput
  )
  if (!password) return {}

  const searchScope: ParentNode = scope ?? password.form ?? document
  const candidates = [
    ...searchScope.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
    ),
  ].filter(
    (input) =>
      isEditableInput(input) &&
      (input.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  )
  return { username: candidates.at(-1), password }
}

/** 将凭据填入当前页面的登录表单（由用户手动触发，不自动填） */
function fillLoginForm(username: string, password: string) {
  try {
    const inputs = findLoginInputs()
    if (!inputs.password) {
      return { success: false, error: "未找到密码输入框，请确认已打开登录页" }
    }

    const filled = { username: false, password: false }
    if (inputs.username && username) {
      setNativeValue(inputs.username, username)
      filled.username = true
    }
    if (password) {
      setNativeValue(inputs.password, password)
      filled.password = true
    }
    inputs.password.focus()
    return { success: true, data: filled }
  } catch (error) {
    console.error("填充登录表单失败:", error)
    return { success: false, error: String(error) }
  }
}

function getStorage(target: StorageTarget): Storage {
  return target === "sessionStorage" ? sessionStorage : localStorage
}

/** 从指定 storage 读取单个键：不存在时 source 记为 not_found，可按 JSON 解析则解析，否则保留原字符串 */
function readEntry(target: StorageTarget, key: string): StorageEntry {
  const raw = getStorage(target).getItem(key)
  if (raw === null) return { value: null, source: "not_found" }
  try {
    return { value: JSON.parse(raw), source: target }
  } catch {
    return { value: raw, source: target }
  }
}

/** 从当前页面的 localStorage/sessionStorage 读取指定键的值（严格按用户选择的 storageType 读取，不自动回退） */
function getStorageData(items: { key: string; storageType?: string }[]): Record<string, unknown> {
  try {
    const results: Record<string, unknown> = {}
    const list = Array.isArray(items) ? items : []
    for (const { key, storageType } of list) {
      const target: StorageTarget =
        storageType === "sessionStorage" ? "sessionStorage" : "localStorage"
      const { value, source } = readEntry(target, key)
      results[key] = value
      results[`${key}${SOURCE_SUFFIX}`] = source
    }
    return results
  } catch (error) {
    console.error("获取存储数据失败:", error)
    return {}
  }
}

/**
 * 将数据写入当前页面的 localStorage/sessionStorage
 * - 以 `<key>_source` 元数据决定写入哪个 storage
 * - 快照里标记为 not_found 的键不做任何改动（避免误删页面上后来才写入的数据）
 * - 值为 null 时写入 "null"，与「键不存在」区分开
 */
function setStorageData(data: Record<string, unknown>) {
  try {
    const results: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.endsWith(SOURCE_SUFFIX)) continue

      const source = data[`${key}${SOURCE_SUFFIX}`]
      if (source === "not_found" || value === undefined) {
        results[key] = { success: true, action: "skipped" }
        continue
      }

      const target: StorageTarget =
        source === "sessionStorage" ? "sessionStorage" : "localStorage"
      getStorage(target).setItem(key, typeof value === "string" ? value : JSON.stringify(value))
      results[key] = { success: true, source: target }
    }

    return { success: true, data: results }
  } catch (error) {
    console.error("设置存储数据失败:", error)
    return { success: false, error: String(error) }
  }
}
