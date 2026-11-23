import type { MessageResponses, MessageType, RequestMessage, RequestPayloads } from "@/types/messages"
import { browser } from "wxt/browser"

/** 已知的业务消息类型，用于运行时校验（新增消息时需同步） */
const MESSAGE_TYPES: MessageType[] = [
  "GET_STORAGE_DATA",
  "SET_STORAGE_DATA",
  "GET_WATCHED_KEYS",
  "ADD_WATCHED_KEY",
  "REMOVE_WATCHED_KEY",
  "GET_ALL_CONFIGS",
  "SAVE_CONFIG",
  "LOAD_CONFIG",
  "DELETE_CONFIG",
  "GET_CURRENT_TAB_URL",
  "GET_CREDENTIALS",
  "SEARCH_CREDENTIALS",
  "SAVE_CREDENTIAL",
  "DELETE_CREDENTIAL",
  "FILL_LOGIN_FORM",
  "CAPTURE_CREDENTIAL",
  "IMPORT_CREDENTIALS",
  "SET_AUTO_CAPTURE",
]

/** 判断未知消息是否为本扩展的业务请求 */
export function isRequestMessage(value: unknown): value is RequestMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) return false
  return MESSAGE_TYPES.includes((value as { type: MessageType }).type)
}

/** 侧边栏向 background 发送消息，返回按消息类型约束的响应 */
export async function sendMessage<T extends MessageType>(
  type: T,
  payload?: RequestPayloads[T]
): Promise<MessageResponses[T]> {
  // 消息通道是运行时边界，响应结构由 background 保证，这里只做类型收敛
  const response = await browser.runtime.sendMessage({ type, ...payload })
  return response as MessageResponses[T]
}
