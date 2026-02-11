/** 存储类型：localStorage 或 sessionStorage */
export type StorageType = "localStorage" | "sessionStorage"

/** 监听的 storage 键：键名 + 存储类型 */
export interface WatchedKey {
  key: string
  storageType: StorageType
}

/** 键值对数据，key 为 storage 键名，value 为任意类型；带 _source 后缀的 key 表示数据来源 */
export interface StorageData {
  [key: string]: unknown
}

/** 已保存的配置项：名称、数据快照、创建时间、来源域名 */
export interface StorageConfig {
  id: string
  name: string
  data: StorageData
  createdAt: string
  domain?: string
}
