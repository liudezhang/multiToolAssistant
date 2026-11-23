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

/** 一条账号凭据；hostname 为保存时的子域，domain 为聚合用的主域 */
export interface Credential {
  id: string
  username: string
  /** 密码按当前实现明文存储（不做加密），见功能说明 */
  password: string
  /** 登录页地址，便于从列表直接打开 */
  loginUrl?: string
  note?: string
  /** 保存时所在子域，如 admin.example.com */
  hostname: string
  /** 聚合用的主域，如 example.com */
  domain: string
  createdAt: string
  updatedAt: string
}

/** 从密码管理器 CSV 导入的一条账号（url 用于推导子域与主域） */
export interface CredentialImportItem {
  url: string
  username: string
  password: string
}
