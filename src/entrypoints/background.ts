/**
 * 后台脚本 (Service Worker)
 * - 点击扩展图标时打开侧边栏
 * - 在侧边栏与 content script 之间转发消息
 * - 管理监听字段、配置的持久化存储
 */
import type { Credential, StorageConfig, StorageData, StorageType, WatchedKey } from "@/types"
import type {
  ContentScriptResult,
  MessageResponses,
  MessageType,
  RequestMessage,
  RequestPayloads,
} from "@/types/messages"
import { getPrimaryDomain } from "@/utils/credential"
import { isRequestMessage } from "@/utils/messaging"
import { isPlainObject } from "es-toolkit/predicate"
import type { Browser } from "wxt/browser"
import { browser } from "wxt/browser"

/** 侧边栏与 background 建立 port 连接时使用的名称（用于页面刷新 / 切换通知） */
const SIDEPANEL_PORT = "sidepanel"
/** 页面加载后延迟刷新，等待 SPA 异步写入 storage（如切换账号后的 token） */
const REFRESH_DELAY_MS = 800

/** 监听字段按域名存储 */
const WATCHED_KEYS_KEY = "watchedKeysByDomain"
/** 配置快照按域名存储 */
const CONFIGS_KEY = "cacheAssistantConfigsByDomain"
/** 账号凭据按「主域」聚合存储（同一个项目下的多个子域归为一组） */
const CREDENTIALS_KEY = "credentialsByDomain"
/** 自动捕获开关，默认开启 */
const AUTO_CAPTURE_KEY = "credentialAutoCapture"
/** 取不到域名时使用的分片键 */
const FALLBACK_DOMAIN = "_default"

type Sender = Browser.runtime.MessageSender
/** 按域名分组的数据结构 */
type DomainStore<T> = Record<string, T>
/** 单个站点的配置集合 */
type ConfigBucket = Record<string, StorageConfig>

/** 当前连接的侧边栏 port，用于主动推送刷新 / 捕获通知 */
const sidepanelPorts = new Set<Browser.runtime.Port>()

function broadcastToSidepanel(message: unknown) {
  for (const port of [...sidepanelPorts]) {
    try {
      port.postMessage(message)
    } catch {
      sidepanelPorts.delete(port)
    }
  }
}

export default defineBackground(() => {
  // 点击扩展图标时打开侧边栏
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

  // 侧边栏通过 port 连接，用于接收页面刷新与自动捕获通知
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== SIDEPANEL_PORT) return
    sidepanelPorts.add(port)
    port.onDisconnect.addListener(() => sidepanelPorts.delete(port))
  })

  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  function notifyCacheAssistantRefresh() {
    broadcastToSidepanel({ type: "PAGE_REFRESHED" })
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      notifyCacheAssistantRefresh()
    }, REFRESH_DELAY_MS)
  }

  // 标签页切换时刷新
  browser.tabs.onActivated.addListener(() => notifyCacheAssistantRefresh())

  // 当前标签页刷新完成或 URL 变化时刷新（延迟执行，等待 SPA 写入 storage）
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    const shouldRefresh =
      changeInfo.status === "complete" || (changeInfo.url && !changeInfo.url.startsWith("chrome:"))
    if (!shouldRefresh) return
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (activeTab?.id === tabId) scheduleRefresh()
  })

  // 消息入口：先校验消息结构，再统一交给 handleMessage 分发
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isRequestMessage(message)) return
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: toErrorMessage(error) }))
    return true
  })
})

/** 按消息类型分发到对应处理函数（case 覆盖全部消息类型，新增类型时会有编译错误提示） */
async function handleMessage(
  message: RequestMessage,
  sender: Sender
): Promise<MessageResponses[MessageType]> {
  switch (message.type) {
    case "GET_STORAGE_DATA":
      return sendToContentScript(await getActiveTabId(sender), {
        type: "GET_STORAGE_DATA",
        items: message.items,
      })
    case "SET_STORAGE_DATA":
      return sendToContentScript(await getActiveTabId(sender), {
        type: "SET_STORAGE_DATA",
        data: message.data,
      })
    case "GET_WATCHED_KEYS":
      return getWatchedKeys(sender)
    case "ADD_WATCHED_KEY":
      return addWatchedKey(message.key, message.storageType, sender)
    case "REMOVE_WATCHED_KEY":
      return removeWatchedKey(message.key, sender)
    case "GET_ALL_CONFIGS":
      return getAllConfigs(sender)
    case "SAVE_CONFIG":
      return saveConfig(message.name, message.data, sender)
    case "LOAD_CONFIG":
      return loadConfig(message.configId, sender)
    case "DELETE_CONFIG":
      return deleteConfig(message.configId, sender)
    case "GET_CURRENT_TAB_URL":
      return getCurrentTabUrl(sender)
    case "GET_CREDENTIALS":
      return getCredentials(sender)
    case "SEARCH_CREDENTIALS":
      return searchCredentials(message.keyword)
    case "SAVE_CREDENTIAL":
      return saveCredential(message, sender)
    case "DELETE_CREDENTIAL":
      return deleteCredential(message.id)
    case "FILL_LOGIN_FORM":
      return sendToContentScript(await getActiveTabId(sender), {
        type: "FILL_LOGIN_FORM",
        username: message.username,
        password: message.password,
      })
    case "CAPTURE_CREDENTIAL":
      return captureCredential(message, sender)
    case "IMPORT_CREDENTIALS":
      return importCredentials(message.items)
    case "SET_AUTO_CAPTURE":
      return setAutoCapture(message.enabled)
  }
  // 新增消息类型但漏写分发时会在这里报编译错误
  const unhandled: never = message
  throw new Error(`未处理的消息类型: ${JSON.stringify(unhandled)}`)
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 获取当前激活标签页 ID（优先使用 sender.tab，否则查询当前窗口激活标签） */
async function getActiveTabId(sender: Sender): Promise<number | undefined> {
  if (sender.tab?.id) return sender.tab.id
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

/** 从标签页 URL 解析域名，用于按站点隔离数据 */
async function getDomainFromTab(tabId: number): Promise<string> {
  try {
    const tab = await browser.tabs.get(tabId)
    if (tab?.url) return new URL(tab.url).hostname
  } catch {
    /* 标签页可能已关闭或无访问权限 */
  }
  return ""
}

/** 当前站点的分片键（取不到域名时归入 _default） */
async function getDomainKey(sender: Sender): Promise<string> {
  const tabId = await getActiveTabId(sender)
  if (!tabId) return FALLBACK_DOMAIN
  const domain = await getDomainFromTab(tabId)
  return domain || FALLBACK_DOMAIN
}

/** 获取当前标签页 URL 和 hostname，用于侧边栏显示当前站点 */
async function getCurrentTabUrl(
  sender: Sender
): Promise<MessageResponses["GET_CURRENT_TAB_URL"]> {
  try {
    const tabId = await getActiveTabId(sender)
    if (tabId) {
      const tab = await browser.tabs.get(tabId)
      if (tab?.url) {
        return { success: true, url: tab.url, hostname: new URL(tab.url).hostname }
      }
    }
  } catch {
    /* 标签页可能已关闭或无访问权限 */
  }
  return { success: false, url: "", hostname: "" }
}

/** storage.local 的读改写串行化，避免并发消息互相覆盖 */
let writeQueue: Promise<unknown> = Promise.resolve()
function serializeWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task)
  writeQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

/** 读取按域名分组的整体结构 */
async function readDomainStore<T>(storageKey: string): Promise<DomainStore<T>> {
  const result = await browser.storage.local.get(storageKey)
  return (result[storageKey] as DomainStore<T> | undefined) ?? {}
}

/** 对指定分片做一次串行化的读改写（分片键由调用方决定，便于按主域而非完整域名分组） */
function updateBucket<T>(
  storageKey: string,
  partitionKey: string,
  update: (bucket: T | undefined, partitionKey: string) => T
): Promise<T> {
  return serializeWrite(async () => {
    const store = await readDomainStore<T>(storageKey)
    const bucket = update(store[partitionKey], partitionKey)
    store[partitionKey] = bucket
    await browser.storage.local.set({ [storageKey]: store })
    return bucket
  })
}

/** 对当前站点的分片做一次串行化的读改写，返回改写后的分片 */
async function updateDomainBucket<T>(
  storageKey: string,
  sender: Sender,
  update: (bucket: T | undefined, domainKey: string) => T
): Promise<T> {
  // 域名在入队前取好，避免排队期间标签页切换导致写入其它站点
  const domainKey = await getDomainKey(sender)
  return updateBucket(storageKey, domainKey, update)
}

/** 兼容旧版数据：老版本只存了键名字符串，storageType 默认 localStorage */
function normalizeKeys(raw: unknown): WatchedKey[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (isPlainObject(item) && "key" in item) {
      return {
        key: String(item.key),
        storageType: (item.storageType === "sessionStorage"
          ? "sessionStorage"
          : "localStorage") as StorageType,
      }
    }
    return { key: String(item), storageType: "localStorage" as StorageType }
  })
}

/** 旧版全局 watchedKeys 迁移到当前站点分片；无旧数据时返回 undefined */
async function migrateLegacyWatchedKeys(domainKey: string): Promise<WatchedKey[] | undefined> {
  const legacy = (await browser.storage.local.get("watchedKeys")).watchedKeys
  if (!Array.isArray(legacy)) return undefined
  const keys = normalizeKeys(legacy)
  await serializeWrite(async () => {
    const store = await readDomainStore<WatchedKey[]>(WATCHED_KEYS_KEY)
    store[domainKey] = keys
    await browser.storage.local.set({ [WATCHED_KEYS_KEY]: store })
  })
  await browser.storage.local.remove("watchedKeys")
  return keys
}

/** 获取当前站点的监听键名列表 */
async function getWatchedKeys(
  sender: Sender
): Promise<MessageResponses["GET_WATCHED_KEYS"]> {
  try {
    const domainKey = await getDomainKey(sender)
    const store = await readDomainStore<WatchedKey[]>(WATCHED_KEYS_KEY)
    const bucket =
      store[domainKey] === undefined
        ? await migrateLegacyWatchedKeys(domainKey)
        : store[domainKey]
    return { success: true, keys: normalizeKeys(bucket) }
  } catch (error) {
    console.error("获取监听的键名列表失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 添加监听的 storage 键名（仅当前站点） */
async function addWatchedKey(
  key: string,
  storageType: StorageType,
  sender: Sender
): Promise<MessageResponses["ADD_WATCHED_KEY"]> {
  try {
    await updateDomainBucket<WatchedKey[]>(WATCHED_KEYS_KEY, sender, (bucket) => {
      const keys = normalizeKeys(bucket)
      if (keys.some((item) => item.key === key)) return keys
      return [...keys, { key, storageType }]
    })
    return { success: true }
  } catch (error) {
    console.error("添加监听的键名失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 移除监听的 storage 键名（仅当前站点） */
async function removeWatchedKey(
  key: string,
  sender: Sender
): Promise<MessageResponses["REMOVE_WATCHED_KEY"]> {
  try {
    await updateDomainBucket<WatchedKey[]>(WATCHED_KEYS_KEY, sender, (bucket) =>
      normalizeKeys(bucket).filter((item) => item.key !== key)
    )
    return { success: true }
  } catch (error) {
    console.error("移除监听的键名失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 向 content script 发消息，失败时先注入脚本再重试（页面刚打开时 content script 可能尚未就绪） */
async function sendWithInjectionRetry(tabId: number, message: ContentScriptMessage) {
  try {
    return await browser.tabs.sendMessage(tabId, message)
  } catch {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["/content-scripts/content.js"],
    })
    return await browser.tabs.sendMessage(tabId, message)
  }
}

type ContentScriptMessage =
  | { type: "GET_STORAGE_DATA"; items: WatchedKey[] }
  | { type: "SET_STORAGE_DATA"; data: StorageData }
  | { type: "FILL_LOGIN_FORM"; username: string; password: string }

/** 读写页面 storage 的统一入口：处理无标签页、连接失败等错误 */
async function sendToContentScript(
  tabId: number | undefined,
  message: ContentScriptMessage
): Promise<ContentScriptResult> {
  if (!tabId) return { success: false, error: "请先打开要操作的网页标签页" }
  try {
    const data = await sendWithInjectionRetry(tabId, message)
    // 填充是「有失败可能」的操作，content script 的失败结果需要向上传递
    if (message.type === "FILL_LOGIN_FORM" && data?.success === false) {
      return { success: false, error: String(data.error ?? "页面操作失败") }
    }
    return { success: true, data: data ?? {} }
  } catch (error) {
    console.error(`向页面发送 ${message.type} 失败:`, error)
    const msg = toErrorMessage(error)
    if (msg.includes("Receiving end does not exist") || msg.includes("Could not establish connection")) {
      return { success: false, error: "无法连接页面，请刷新目标网页后重试" }
    }
    return { success: false, error: msg }
  }
}

/** 旧版全局配置迁移为按域名分组；无旧数据时返回 undefined */
async function migrateLegacyConfigs(): Promise<DomainStore<ConfigBucket> | undefined> {
  const legacy = (await browser.storage.local.get("cacheAssistantConfigs"))
    .cacheAssistantConfigs as DomainStore<StorageConfig> | undefined
  if (!legacy || Object.keys(legacy).length === 0) return undefined

  const byDomain: DomainStore<ConfigBucket> = {}
  for (const config of Object.values(legacy)) {
    const domainKey = config.domain || FALLBACK_DOMAIN
    if (!byDomain[domainKey]) byDomain[domainKey] = {}
    byDomain[domainKey][config.id] = config
  }
  await serializeWrite(() => browser.storage.local.set({ [CONFIGS_KEY]: byDomain }))
  await browser.storage.local.remove("cacheAssistantConfigs")
  return byDomain
}

/** 获取当前站点的已保存配置 */
async function getAllConfigs(
  sender: Sender
): Promise<MessageResponses["GET_ALL_CONFIGS"]> {
  try {
    const domainKey = await getDomainKey(sender)
    let store = await readDomainStore<ConfigBucket>(CONFIGS_KEY)
    if (Object.keys(store).length === 0) {
      store = (await migrateLegacyConfigs()) ?? store
    }
    return { success: true, configs: store[domainKey] ?? {} }
  } catch (error) {
    console.error("获取配置失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 保存当前页面 storage 快照（仅当前站点）；同名配置同组覆盖 */
async function saveConfig(
  name: string,
  data: StorageData,
  sender: Sender
): Promise<MessageResponses["SAVE_CONFIG"]> {
  try {
    let savedId = ""
    await updateDomainBucket<ConfigBucket>(CONFIGS_KEY, sender, (bucket, domainKey) => {
      const configs = bucket ?? {}
      const createdAt = new Date().toISOString()
      // 同一站点下同名配置只保留一条，重复保存即更新快照
      const existing = Object.values(configs).find((config) => config.name === name)
      if (existing) {
        savedId = existing.id
        return { ...configs, [existing.id]: { ...existing, data, createdAt } }
      }
      savedId = `config_${Date.now()}`
      return {
        ...configs,
        [savedId]: {
          id: savedId,
          name,
          data,
          createdAt,
          domain: domainKey === FALLBACK_DOMAIN ? undefined : domainKey,
        },
      }
    })
    return { success: true, configId: savedId }
  } catch (error) {
    console.error("保存配置失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 加载指定配置的数据（仅当前站点） */
async function loadConfig(
  configId: string,
  sender: Sender
): Promise<MessageResponses["LOAD_CONFIG"]> {
  try {
    const domainKey = await getDomainKey(sender)
    const store = await readDomainStore<ConfigBucket>(CONFIGS_KEY)
    const config = store[domainKey]?.[configId]
    if (!config) return { success: false, error: "配置不存在" }
    return { success: true, data: config.data }
  } catch (error) {
    console.error("加载配置失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 删除指定配置（仅当前站点） */
async function deleteConfig(
  configId: string,
  sender: Sender
): Promise<MessageResponses["DELETE_CONFIG"]> {
  try {
    const domainKey = await getDomainKey(sender)
    return await serializeWrite(async () => {
      const store = await readDomainStore<ConfigBucket>(CONFIGS_KEY)
      const bucket = store[domainKey]
      if (!bucket?.[configId]) return { success: false, error: "配置不存在" }
      delete bucket[configId]
      await browser.storage.local.set({ [CONFIGS_KEY]: store })
      return { success: true }
    })
  } catch (error) {
    console.error("删除配置失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 当前标签页的完整域名与聚合用主域 */
async function getSiteScope(sender: Sender): Promise<{ hostname: string; domain: string }> {
  const tabId = await getActiveTabId(sender)
  const hostname = tabId ? await getDomainFromTab(tabId) : ""
  return { hostname, domain: getPrimaryDomain(hostname) || FALLBACK_DOMAIN }
}

/** 当前主域下的全部账号（同一项目的多个子域聚合在一起） */
async function getCredentials(
  sender: Sender
): Promise<MessageResponses["GET_CREDENTIALS"]> {
  try {
    const { domain } = await getSiteScope(sender)
    const store = await readDomainStore<Credential[]>(CREDENTIALS_KEY)
    return {
      success: true,
      credentials: store[domain] ?? [],
      autoCapture: await getAutoCaptureEnabled(),
    }
  } catch (error) {
    console.error("获取账号列表失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 全站搜索：按账号名 / 备注 / 主域 / 子域匹配 */
async function searchCredentials(
  keyword: string
): Promise<MessageResponses["SEARCH_CREDENTIALS"]> {
  try {
    const query = keyword.trim().toLowerCase()
    if (!query) return { success: true, credentials: [] }
    const store = await readDomainStore<Credential[]>(CREDENTIALS_KEY)
    const credentials = Object.values(store)
      .flat()
      .filter((item) =>
        [item.username, item.note, item.domain, item.hostname].some((field) =>
          field?.toLowerCase().includes(query)
        )
      )
    return { success: true, credentials }
  } catch (error) {
    console.error("搜索账号失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 找到某条账号所在的存储分片（搜索结果的条目可能不属于当前站点） */
async function findCredentialShard(id: string): Promise<string | undefined> {
  const store = await readDomainStore<Credential[]>(CREDENTIALS_KEY)
  return Object.keys(store).find((key) => store[key]?.some((item) => item.id === id))
}

/** 新增或编辑账号；同一子域下同名账号视为同一条，重复保存即更新 */
async function saveCredential(
  payload: RequestPayloads["SAVE_CREDENTIAL"],
  sender: Sender
): Promise<MessageResponses["SAVE_CREDENTIAL"]> {
  try {
    const now = new Date().toISOString()

    if (payload.id) {
      const shard = await findCredentialShard(payload.id)
      if (!shard) return { success: false, error: "账号不存在" }
      await updateBucket<Credential[]>(CREDENTIALS_KEY, shard, (bucket) =>
        (bucket ?? []).map((item) =>
          item.id === payload.id
            ? { ...item, ...payload, id: item.id, hostname: item.hostname, domain: item.domain, updatedAt: now }
            : item
        )
      )
      return { success: true, credentialId: payload.id }
    }

    const { hostname, domain } = await getSiteScope(sender)
    if (!hostname) return { success: false, error: "请先打开要保存账号的网页标签页" }

    let savedId = ""
    await updateBucket<Credential[]>(CREDENTIALS_KEY, domain, (bucket) => {
      const list = bucket ?? []
      const existing = list.find(
        (item) => item.hostname === hostname && item.username === payload.username
      )
      if (existing) {
        savedId = existing.id
        return list.map((item) =>
          item.id === existing.id ? { ...item, ...payload, id: existing.id, updatedAt: now } : item
        )
      }
      savedId = `credential_${Date.now()}`
      return [
        ...list,
        { id: savedId, hostname, domain, createdAt: now, updatedAt: now, ...payload },
      ]
    })
    return { success: true, credentialId: savedId }
  } catch (error) {
    console.error("保存账号失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 删除账号（不限定当前站点，搜索结果里的条目也能删） */
async function deleteCredential(id: string): Promise<MessageResponses["DELETE_CREDENTIAL"]> {
  try {
    const shard = await findCredentialShard(id)
    if (!shard) return { success: false, error: "账号不存在" }
    await updateBucket<Credential[]>(CREDENTIALS_KEY, shard, (bucket) =>
      (bucket ?? []).filter((item) => item.id !== id)
    )
    return { success: true }
  } catch (error) {
    console.error("删除账号失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 自动捕获开关（默认开启） */
async function getAutoCaptureEnabled(): Promise<boolean> {
  const result = await browser.storage.local.get(AUTO_CAPTURE_KEY)
  return result[AUTO_CAPTURE_KEY] !== false
}

async function setAutoCapture(enabled: boolean): Promise<MessageResponses["SET_AUTO_CAPTURE"]> {
  try {
    await browser.storage.local.set({ [AUTO_CAPTURE_KEY]: enabled })
    return { success: true }
  } catch (error) {
    console.error("保存自动捕获开关失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

function parseHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

interface CredentialDraft {
  hostname: string
  username: string
  password: string
  loginUrl?: string
}

/**
 * 写入一条新账号；同一子域下已存在同名账号时**不覆盖**
 * （自动捕获 / 导入都走这里，避免输错密码把正确记录冲掉）
 */
async function createCredentialIfAbsent(draft: CredentialDraft): Promise<boolean> {
  const domain = getPrimaryDomain(draft.hostname) || FALLBACK_DOMAIN
  let created = false
  await updateBucket<Credential[]>(CREDENTIALS_KEY, domain, (bucket) => {
    const list = bucket ?? []
    if (list.some((item) => item.hostname === draft.hostname && item.username === draft.username)) {
      return list
    }
    created = true
    const now = new Date().toISOString()
    return [
      ...list,
      {
        id: `credential_${now}_${Math.random().toString(36).slice(2, 8)}`,
        username: draft.username,
        password: draft.password,
        loginUrl: draft.loginUrl,
        hostname: draft.hostname,
        domain,
        createdAt: now,
        updatedAt: now,
      },
    ]
  })
  return created
}

/** 登录表单自动捕获：只补空缺，不修改已有账号 */
async function captureCredential(
  payload: RequestPayloads["CAPTURE_CREDENTIAL"],
  sender: Sender
): Promise<MessageResponses["CAPTURE_CREDENTIAL"]> {
  try {
    if (!(await getAutoCaptureEnabled())) return { success: true, saved: false }

    const tabId = await getActiveTabId(sender)
    const hostname = tabId ? await getDomainFromTab(tabId) : ""
    if (!hostname) return { success: true, saved: false }

    const saved = await createCredentialIfAbsent({
      hostname,
      username: payload.username,
      password: payload.password,
      loginUrl: `https://${hostname}`,
    })
    if (saved) {
      broadcastToSidepanel({ type: "CREDENTIAL_CAPTURED", username: payload.username })
    }
    return { success: true, saved }
  } catch (error) {
    console.error("自动捕获账号失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}

/** 从浏览器导出的密码 CSV 批量导入；已存在的账号跳过 */
async function importCredentials(
  items: RequestPayloads["IMPORT_CREDENTIALS"]["items"]
): Promise<MessageResponses["IMPORT_CREDENTIALS"]> {
  try {
    let imported = 0
    let skipped = 0
    for (const item of items) {
      const hostname = parseHostname(item.url)
      if (!hostname || !item.username) {
        skipped++
        continue
      }
      const created = await createCredentialIfAbsent({
        hostname,
        username: item.username,
        password: item.password,
        loginUrl: item.url,
      })
      if (created) imported++
      else skipped++
    }
    if (imported > 0) broadcastToSidepanel({ type: "CREDENTIAL_IMPORTED", imported })
    return { success: true, imported, skipped }
  } catch (error) {
    console.error("导入账号失败:", error)
    return { success: false, error: toErrorMessage(error) }
  }
}
