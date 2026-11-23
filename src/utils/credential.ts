/**
 * 账号助手工具函数
 * - 主域归并：把 a.example.com / b.example.com 归到同一分组
 * - 密码掩码：列表内默认不显示真实内容
 */

/**
 * 取 hostname 的主域近似值（最后两段）
 * - IP / localhost / 单段主机原样返回
 * - co.uk、com.cn 这类多级后缀会判错，如需精确需引入公共后缀列表
 */
export function getPrimaryDomain(hostname: string): string {
  if (!hostname) return ""
  // IPv4 / IPv6（hostname 里的 IPv6 带方括号）
  if (hostname.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return hostname
  const parts = hostname.split(".").filter(Boolean)
  return parts.length <= 2 ? hostname : parts.slice(-2).join(".")
}

/** 密码掩码：固定长度，不暴露真实密码长度 */
export function maskPassword(password: string): string {
  return password ? "•".repeat(8) : "（未填写）"
}
