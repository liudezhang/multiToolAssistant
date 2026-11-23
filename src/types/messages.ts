/**
 * 侧边栏 ↔ background 的消息契约
 * - RequestPayloads：按消息类型声明载荷字段
 * - MessageResponses：按消息类型声明响应字段
 * 新增消息时同时补齐这两处，background 的 switch 会做穷尽检查
 */
import type {
  Credential,
  CredentialImportItem,
  StorageConfig,
  StorageData,
  StorageType,
  WatchedKey,
} from "@/types"

/** 新增/编辑账号时提交的字段；带 id 表示编辑已有条目 */
export interface CredentialInput {
  id?: string
  username: string
  password: string
  loginUrl?: string
  note?: string
}

export interface RequestPayloads {
  GET_STORAGE_DATA: { items: WatchedKey[] }
  SET_STORAGE_DATA: { data: StorageData }
  GET_WATCHED_KEYS: Record<string, never>
  ADD_WATCHED_KEY: { key: string; storageType: StorageType }
  REMOVE_WATCHED_KEY: { key: string }
  GET_ALL_CONFIGS: Record<string, never>
  SAVE_CONFIG: { name: string; data: StorageData }
  LOAD_CONFIG: { configId: string }
  DELETE_CONFIG: { configId: string }
  GET_CURRENT_TAB_URL: Record<string, never>
  GET_CREDENTIALS: Record<string, never>
  SEARCH_CREDENTIALS: { keyword: string }
  SAVE_CREDENTIAL: CredentialInput
  DELETE_CREDENTIAL: { id: string }
  FILL_LOGIN_FORM: { username: string; password: string }
  CAPTURE_CREDENTIAL: { username: string; password: string }
  IMPORT_CREDENTIALS: { items: CredentialImportItem[] }
  SET_AUTO_CAPTURE: { enabled: boolean }
}

export type MessageType = keyof RequestPayloads

/** 侧边栏发给 background 的消息（分配式条件类型，保证按 type 窄化） */
export type RequestMessage<T extends MessageType = MessageType> = T extends MessageType
  ? { type: T } & RequestPayloads[T]
  : never

export interface MessageResponses {
  GET_STORAGE_DATA: ContentScriptResult
  SET_STORAGE_DATA: ContentScriptResult
  GET_WATCHED_KEYS: { success: boolean; keys?: WatchedKey[]; error?: string }
  ADD_WATCHED_KEY: { success: boolean; error?: string }
  REMOVE_WATCHED_KEY: { success: boolean; error?: string }
  GET_ALL_CONFIGS: { success: boolean; configs?: Record<string, StorageConfig>; error?: string }
  SAVE_CONFIG: { success: boolean; configId?: string; error?: string }
  LOAD_CONFIG: { success: boolean; data?: StorageData; error?: string }
  DELETE_CONFIG: { success: boolean; error?: string }
  GET_CURRENT_TAB_URL: { success: boolean; url: string; hostname: string }
  GET_CREDENTIALS: {
    success: boolean
    credentials?: Credential[]
    /** 自动捕获开关（随列表一起下发，省一次往返） */
    autoCapture?: boolean
    error?: string
  }
  SEARCH_CREDENTIALS: { success: boolean; credentials?: Credential[]; error?: string }
  SAVE_CREDENTIAL: { success: boolean; credentialId?: string; error?: string }
  DELETE_CREDENTIAL: { success: boolean; error?: string }
  FILL_LOGIN_FORM: ContentScriptResult
  CAPTURE_CREDENTIAL: { success: boolean; saved?: boolean; error?: string }
  IMPORT_CREDENTIALS: { success: boolean; imported?: number; skipped?: number; error?: string }
  SET_AUTO_CAPTURE: { success: boolean; error?: string }
}

/** 转发给 content script 后返回的结果 */
export interface ContentScriptResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}
