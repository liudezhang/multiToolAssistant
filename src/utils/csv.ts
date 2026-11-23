/**
 * CSV 解析（RFC 4180 子集）
 * 用于导入浏览器 / 密码管理器导出的密码文件，不引入第三方依赖
 */
import type { CredentialImportItem } from "@/types"

export interface CsvTable {
  /** 表头（已转小写并 trim），用于按列名取值 */
  keys: string[]
  records: Array<Record<string, string>>
}

/** 逐字符扫描，支持引号包裹、"" 转义引号、字段内换行与 CRLF */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char !== '"') {
        cell += char
        continue
      }
      if (text[i + 1] === '"') {
        cell += '"'
        i++
        continue
      }
      quoted = false
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\r") {
      continue
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** 解析带表头的 CSV 文本 */
export function parseCsv(text: string): CsvTable {
  const rows = splitCsvRows(text.replace(/^\uFEFF/, ""))
  const header = rows.shift()
  if (!header) return { keys: [], records: [] }

  const keys = header.map((cell) => cell.trim().toLowerCase())
  const records = rows
    // 跳过完全空白的行
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {}
      keys.forEach((key, index) => {
        // 值不做 trim：密码可能以空格开头/结尾，trim 会改坏数据
        record[key] = row[index] ?? ""
      })
      return record
    })

  return { keys, records }
}

/**
 * 从密码管理器导出的 CSV 中提取「url / 账号 / 密码」
 * 按表头名匹配，兼容 Chrome（name,url,username,password）、Firefox（url,username,password）
 * 与 Bitwarden（login_uri,login_username,login_password）的导出格式
 */
export function parseCredentialCsv(text: string): CredentialImportItem[] {
  const { keys, records } = parseCsv(text)
  if (!keys.length || !records.length) return []

  const urlKey = keys.find((key) => /url|uri|origin/.test(key))
  const passwordKey = keys.find((key) => /password/.test(key))
  const usernameKey = keys.find((key) => /user/.test(key) && key !== passwordKey)
  if (!urlKey || !passwordKey || !usernameKey) return []

  return records
    .map((record) => ({
      // url 与账号做 trim，密码原样保留
      url: (record[urlKey] ?? "").trim(),
      username: (record[usernameKey] ?? "").trim(),
      password: record[passwordKey] ?? "",
    }))
    .filter((item) => item.url && item.username)
}
