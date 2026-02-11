/**
 * 内容脚本 - 注入到所有网页
 * 在页面上下文中读写 localStorage / sessionStorage
 * 由 background 通过 tabs.sendMessage 调用
 */
import { browser } from "wxt/browser"
import { normalizeStorageItems } from "../utils/storage"

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  main() {
    console.log("多工具助手内容脚本已注入")

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
    })
  },
})

/** 从当前页面的 localStorage/sessionStorage 读取指定键的值（严格按用户选择的 storageType 读取，不自动回退） */
function getStorageData(items: { key: string; storageType?: string }[]) {
  try {
    const results: Record<string, unknown> = {}
    const list = Array.isArray(items) ? items : []
    list.forEach(({ key, storageType: preferred = "localStorage" }) => {
      if (preferred === "sessionStorage") {
        const sessionValue = sessionStorage.getItem(key)
        if (sessionValue !== null) {
          try {
            results[key] = JSON.parse(sessionValue)
          } catch {
            results[key] = sessionValue
          }
          results[`${key}_source`] = "sessionStorage"
        } else {
          results[key] = null
          results[`${key}_source`] = "not_found"
        }
      } else {
        const localValue = localStorage.getItem(key)
        if (localValue !== null) {
          try {
            results[key] = JSON.parse(localValue)
          } catch {
            results[key] = localValue
          }
          results[`${key}_source`] = "localStorage"
        } else {
          results[key] = null
          results[`${key}_source`] = "not_found"
        }
      }
    })

    return results
  } catch (error) {
    console.error("获取存储数据失败:", error)
    return {}
  }
}

/** 将数据写入当前页面的 localStorage/sessionStorage（key 带 _source 后缀表示存储类型） */
function setStorageData(data: Record<string, unknown>) {
  try {
    const results: Record<string, unknown> = {}

    Object.entries(data).forEach(([key, value]) => {
      if (key.endsWith("_source")) return

      const sourceKey = `${key}_source`
      const source = data[sourceKey] || "localStorage"

      if (value !== null && value !== undefined) {
        const stringValue = typeof value === "string" ? value : JSON.stringify(value)

        if (source === "localStorage") {
          localStorage.setItem(key, stringValue)
          results[key] = { success: true, source: "localStorage" }
        } else if (source === "sessionStorage") {
          sessionStorage.setItem(key, stringValue)
          results[key] = { success: true, source: "sessionStorage" }
        } else {
          localStorage.setItem(key, stringValue)
          results[key] = { success: true, source: "localStorage" }
        }
      } else {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
        results[key] = { success: true, action: "removed" }
      }
    })

    return { success: true, data: results }
  } catch (error) {
    console.error("设置存储数据失败:", error)
    return { success: false, error: String(error) }
  }
}
