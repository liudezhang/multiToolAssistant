/**
 * 后台脚本 (Service Worker)
 * - 点击扩展图标时打开侧边栏
 * - 在侧边栏与 content script 之间转发消息
 * - 管理监听字段、配置的持久化存储
 */
import { isPlainObject } from "es-toolkit/predicate"
import { browser } from "wxt/browser"
import type { StorageConfig } from "../types"
import { normalizeStorageItems } from "../utils/storage"

const sidepanelPorts: Set<{ postMessage: (msg: unknown) => void }> = new Set()

export default defineBackground(() => {
  // 点击扩展图标时打开侧边栏
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

  // 侧边栏通过 port 连接，用于接收 tab 切换通知
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "cache-assistant-sidepanel") return
    sidepanelPorts.add(port)
    port.onDisconnect.addListener(() => {
      sidepanelPorts.delete(port)
    })
  })

  // 标签页切换时通知侧边栏刷新缓存数据
  browser.tabs.onActivated.addListener(() => {
    ;[...sidepanelPorts].forEach((port) => {
      try {
        port.postMessage({ type: "TAB_ACTIVATED" })
      } catch {
        sidepanelPorts.delete(port)
      }
    })
  })

  // 监听来自侧边栏的消息并路由到对应处理函数
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STORAGE_DATA") {
      getActiveTabId(sender).then((tabId) => {
        const items = normalizeStorageItems(message.items, message.keys)
        handleGetStorageData(items, tabId).then(sendResponse)
      })
      return true
    }
    if (message.type === "SET_STORAGE_DATA") {
      getActiveTabId(sender).then((tabId) => {
        handleSetStorageData(message.data, tabId).then(sendResponse)
      })
      return true
    }
    if (message.type === "GET_WATCHED_KEYS") {
      getWatchedKeys(sender).then(sendResponse)
      return true
    }
    if (message.type === "ADD_WATCHED_KEY") {
      addWatchedKey(message.key, message.storageType, sender).then(sendResponse)
      return true
    }
    if (message.type === "REMOVE_WATCHED_KEY") {
      removeWatchedKey(message.key, sender).then(sendResponse)
      return true
    }
    if (message.type === "GET_ALL_CONFIGS") {
      getAllConfigs(sender).then(sendResponse)
      return true
    }
    if (message.type === "SAVE_CONFIG") {
      saveConfig(message.name, message.data, sender).then(sendResponse)
      return true
    }
    if (message.type === "LOAD_CONFIG") {
      loadConfig(message.configId, sender).then(sendResponse)
      return true
    }
    if (message.type === "DELETE_CONFIG") {
      deleteConfig(message.configId, sender).then(sendResponse)
      return true
    }
    if (message.type === "GET_CURRENT_TAB_URL") {
      getCurrentTabUrl(sender).then(sendResponse)
      return true
    }
  })
})

/** 获取当前激活标签页 ID（优先使用 sender.tab，否则查询当前窗口激活标签） */
async function getActiveTabId(sender: { tab?: { id?: number } }): Promise<number | undefined> {
  if (sender.tab?.id) return sender.tab.id
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

/** 获取当前标签页 URL 和 hostname，用于侧边栏显示当前站点 */
async function getCurrentTabUrl(sender: { tab?: { id?: number } }) {
  try {
    const tabId = await getActiveTabId(sender)
    if (!tabId) return { success: false, url: "", hostname: "" }
    const tab = await browser.tabs.get(tabId)
    if (tab?.url) {
      const url = new URL(tab.url)
      return { success: true, url: tab.url, hostname: url.hostname }
    }
  } catch {
    /* ignore */
  }
  return { success: false, url: "", hostname: "" }
}

/** 从标签页 URL 解析域名，用于保存配置时记录来源 */
async function getDomainFromTab(tabId: number): Promise<string> {
  try {
    const tab = await browser.tabs.get(tabId)
    if (tab?.url) {
      const url = new URL(tab.url)
      return url.hostname
    }
  } catch {
    /* ignore */
  }
  return ""
}

const STORAGE_KEY = "watchedKeysByDomain"
type WatchedKeyItem = { key: string; storageType: string }

function normalizeKeys(raw: unknown): WatchedKeyItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (isPlainObject(item) && "key" in item && "storageType" in item) {
      return { key: String(item.key), storageType: String(item.storageType) }
    }
    return { key: String(item), storageType: "localStorage" }
  })
}

/** 获取当前标签页的 domain（用于按站点区分监听字段） */
async function getDomainFromSender(sender: { tab?: { id?: number } }): Promise<string> {
  const tabId = await getActiveTabId(sender)
  return tabId ? getDomainFromTab(tabId) : ""
}

/** 从 storage.local 读取当前站点的监听键名列表 */
async function getWatchedKeys(sender: { tab?: { id?: number } }) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get([STORAGE_KEY, "watchedKeys"])
    const byDomain = (result[STORAGE_KEY] as Record<string, unknown>) ?? {}
    let raw = byDomain[domainKey]
    if (!raw && Array.isArray(result.watchedKeys)) {
      // 迁移旧版全局 watchedKeys 到当前站点
      byDomain[domainKey] = result.watchedKeys
      await browser.storage.local.set({ [STORAGE_KEY]: byDomain })
      await browser.storage.local.remove("watchedKeys")
      raw = result.watchedKeys
    }
    const keys = normalizeKeys(raw)
    return { success: true, keys }
  } catch (error) {
    console.error("获取监听的键名列表失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 添加监听的 storage 键名（仅当前站点） */
async function addWatchedKey(key: string, storageType: string, sender: { tab?: { id?: number } }) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get(STORAGE_KEY)
    const byDomain: Record<string, WatchedKeyItem[]> =
      (result[STORAGE_KEY] as Record<string, WatchedKeyItem[]>) ?? {}
    const keys = normalizeKeys(byDomain[domainKey] ?? [])
    if (!keys.some((item) => item.key === key)) {
      keys.push({ key, storageType })
      byDomain[domainKey] = keys
      await browser.storage.local.set({ [STORAGE_KEY]: byDomain })
    }
    return { success: true }
  } catch (error) {
    console.error("添加监听的键名失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 移除监听的 storage 键名（仅当前站点） */
async function removeWatchedKey(key: string, sender: { tab?: { id?: number } }) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get(STORAGE_KEY)
    const byDomain: Record<string, WatchedKeyItem[]> =
      (result[STORAGE_KEY] as Record<string, WatchedKeyItem[]>) ?? {}
    const keys = normalizeKeys(byDomain[domainKey] ?? []).filter((item) => item.key !== key)
    byDomain[domainKey] = keys
    await browser.storage.local.set({ [STORAGE_KEY]: byDomain })
    return { success: true }
  } catch (error) {
    console.error("移除监听的键名失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 向 content script 请求获取页面 storage 数据，失败时尝试先注入脚本再重试 */
async function handleGetStorageData(
  items: { key: string; storageType?: string }[],
  tabId: number | undefined
) {
  if (!tabId) {
    return { success: false, error: "请先打开要操作的网页标签页" }
  }
  try {
    let results: Record<string, unknown>
    try {
      results = await browser.tabs.sendMessage(tabId, {
        type: "GET_STORAGE_DATA",
        items,
      })
    } catch {
      try {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ["content-scripts/content.js"],
        })
        results = await browser.tabs.sendMessage(tabId, {
          type: "GET_STORAGE_DATA",
          items,
        })
      } catch (retryErr) {
        throw retryErr
      }
    }
    return { success: true, data: results ?? {} }
  } catch (error) {
    console.error("获取存储数据失败:", error)
    const msg = error instanceof Error ? error.message : String(error)
    if (
      msg.includes("Receiving end does not exist") ||
      msg.includes("Could not establish connection")
    ) {
      return { success: false, error: "无法连接页面，请刷新目标网页后重试" }
    }
    return { success: false, error: msg }
  }
}

/** 向 content script 请求将数据写入页面 storage */
async function handleSetStorageData(data: Record<string, unknown>, tabId: number | undefined) {
  if (!tabId) {
    return { success: false, error: "请先打开要操作的网页标签页" }
  }
  try {
    const results = await browser.tabs.sendMessage(tabId, {
      type: "SET_STORAGE_DATA",
      data,
    })
    return { success: true, data: results }
  } catch (error) {
    console.error("设置存储数据失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const CONFIGS_STORAGE_KEY = "cacheAssistantConfigsByDomain"

/** 获取当前站点的已保存配置 */
async function getAllConfigs(sender: { tab?: { id?: number } }) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get([CONFIGS_STORAGE_KEY, "cacheAssistantConfigs"])
    let byDomain =
      (result[CONFIGS_STORAGE_KEY] as Record<string, Record<string, StorageConfig>>) ?? {}
    const oldConfigs = result.cacheAssistantConfigs as Record<string, StorageConfig> | undefined
    if (oldConfigs && Object.keys(oldConfigs).length > 0 && Object.keys(byDomain).length === 0) {
      byDomain = migrateOldConfigs(oldConfigs)
      await browser.storage.local.set({ [CONFIGS_STORAGE_KEY]: byDomain })
      await browser.storage.local.remove("cacheAssistantConfigs")
    }
    const configs = byDomain[domainKey] ?? {}
    return { success: true, configs }
  } catch (error) {
    console.error("获取配置失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function migrateOldConfigs(
  old: Record<string, StorageConfig>
): Record<string, Record<string, StorageConfig>> {
  const byDomain: Record<string, Record<string, StorageConfig>> = {}
  for (const config of Object.values(old)) {
    const domainKey = config.domain || "_default"
    if (!byDomain[domainKey]) byDomain[domainKey] = {}
    byDomain[domainKey][config.id] = config
  }
  return byDomain
}

/** 保存当前页面 storage 快照（仅当前站点） */
async function saveConfig(
  name: string,
  data: Record<string, unknown>,
  sender: { tab?: { id?: number } }
) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get(CONFIGS_STORAGE_KEY)
    const byDomain: Record<string, Record<string, StorageConfig>> = (result[
      CONFIGS_STORAGE_KEY
    ] as Record<string, Record<string, StorageConfig>>) ?? {}
    if (!byDomain[domainKey]) byDomain[domainKey] = {}
    const configId = `config_${Date.now()}`
    const newConfig: StorageConfig = {
      id: configId,
      name,
      data,
      createdAt: new Date().toISOString(),
      domain: domain || undefined,
    }
    byDomain[domainKey][configId] = newConfig
    await browser.storage.local.set({ [CONFIGS_STORAGE_KEY]: byDomain })
    return { success: true, configId }
  } catch (error) {
    console.error("保存配置失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 加载指定配置的数据（仅当前站点） */
async function loadConfig(configId: string, sender: { tab?: { id?: number } }) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get(CONFIGS_STORAGE_KEY)
    const byDomain =
      (result[CONFIGS_STORAGE_KEY] as Record<string, Record<string, StorageConfig>>) ?? {}
    const config = byDomain[domainKey]?.[configId]
    if (!config) {
      return { success: false, error: "配置不存在" }
    }
    return { success: true, data: config.data }
  } catch (error) {
    console.error("加载配置失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 删除指定配置（仅当前站点） */
async function deleteConfig(configId: string, sender: { tab?: { id?: number } }) {
  try {
    const domain = await getDomainFromSender(sender)
    const domainKey = domain || "_default"
    const result = await browser.storage.local.get(CONFIGS_STORAGE_KEY)
    const byDomain: Record<string, Record<string, StorageConfig>> = (result[
      CONFIGS_STORAGE_KEY
    ] as Record<string, Record<string, StorageConfig>>) ?? {}
    if (!byDomain[domainKey]?.[configId]) {
      return { success: false, error: "配置不存在" }
    }
    delete byDomain[domainKey][configId]
    await browser.storage.local.set({ [CONFIGS_STORAGE_KEY]: byDomain })
    return { success: true }
  } catch (error) {
    console.error("删除配置失败:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
