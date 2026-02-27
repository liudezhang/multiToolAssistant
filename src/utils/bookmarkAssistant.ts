/**
 * 书签助手工具函数
 * - 树形结构转换
 * - 导出 HTML (Netscape 格式) / JSON / Excel
 */
import he from "he"
import * as XLSX from "xlsx"

/** 浏览器书签节点（与 chrome.bookmarks.BookmarkTreeNode 一致） */
export interface BookmarkTreeNode {
  id: string
  title?: string
  url?: string
  parentId?: string
  index?: number
  dateAdded?: number
  dateGroupModified?: number
  children?: BookmarkTreeNode[]
}

/** 用于 el-tree 的节点格式 */
export interface BookmarkTreeItem {
  id: string
  label: string
  url?: string
  children?: BookmarkTreeItem[]
  isFolder: boolean
  dateAdded?: number
  raw: BookmarkTreeNode
}

/** 将浏览器书签树转为 el-tree 可用的格式 */
export function toTreeItems(nodes: BookmarkTreeNode[] | undefined): BookmarkTreeItem[] {
  if (!nodes?.length) return []
  return nodes
    .filter((n) => n.id !== "0") // 过滤根节点，保留书签栏、其他书签等
    .map((node) => ({
      id: node.id,
      label: node.title || "(无标题)",
      url: node.url,
      isFolder: !node.url,
      dateAdded: node.dateAdded,
      raw: node,
      children: node.children?.length
        ? toTreeItems(node.children)
        : undefined,
    }))
}

/** 递归收集所有书签（含嵌套）为扁平列表 */
export function flattenBookmarks(
  nodes: BookmarkTreeNode[] | undefined,
  acc: Array<{ id: string; title: string; url?: string; parentId?: string }> = []
): Array<{ id: string; title: string; url?: string; parentId?: string }> {
  if (!nodes) return acc
  for (const node of nodes) {
    if (node.url) {
      acc.push({
        id: node.id,
        title: node.title || "",
        url: node.url,
        parentId: node.parentId,
      })
    }
    if (node.children?.length) {
      flattenBookmarks(node.children, acc)
    }
  }
  return acc
}

/** 生成 Netscape 书签 HTML 格式（可导入浏览器） */
export function toNetscapeHtml(nodes: BookmarkTreeNode[], title = "书签导出"): string {
  const lines: string[] = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<!-- This is an automatically generated file. -->',
    `<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">`,
    `<title>${he.escape(title)}</title>`,
    "<h1>书签</h1>",
    "<dl><p>",
  ]

  function emitNode(node: BookmarkTreeNode, indent: string) {
    if (node.id === "0") return
    const addDate = node.dateAdded ? Math.floor(node.dateAdded / 1000) : 0
    if (node.url) {
      lines.push(
        `${indent}<dt><a href="${he.escape(node.url)}" add_date="${addDate}">${he.escape(node.title || "")}</a></dt>`
      )
    } else {
      lines.push(`${indent}<dt><h3 add_date="${addDate}">${he.escape(node.title || "")}</h3></dt>`)
      lines.push(`${indent}<dl><p>`)
      node.children?.forEach((c) => emitNode(c, indent + "    "))
      lines.push(`${indent}</dl><p>`)
    }
  }

  for (const root of nodes) {
    if (root.children) {
      root.children.forEach((c) => emitNode(c, "    "))
    }
  }

  lines.push("</dl><p>")
  return lines.join("\n")
}

/** 扁平化书签为表格行（含文件夹路径） */
function flattenToRows(
  nodes: BookmarkTreeNode[] | undefined,
  path: string[] = []
): Array<{ 文件夹路径: string; 标题: string; URL: string; 添加时间: string }> {
  const rows: Array<{ 文件夹路径: string; 标题: string; URL: string; 添加时间: string }> = []
  if (!nodes) return rows
  for (const node of nodes) {
    if (node.id === "0") continue
    const title = node.title || "(无标题)"
    const pathStr = path.join(" / ")
    const dateStr = node.dateAdded
      ? new Date(node.dateAdded).toLocaleString("zh-CN")
      : ""
    if (node.url) {
      rows.push({ 文件夹路径: pathStr, 标题: title, URL: node.url, 添加时间: dateStr })
    }
    if (node.children?.length) {
      rows.push(...flattenToRows(node.children, [...path, title]))
    }
  }
  return rows
}

/** 导出为 Excel (.xlsx) 的 Uint8Array */
export function toExportExcel(nodes: BookmarkTreeNode[]): Uint8Array {
  const roots = nodes[0]?.children ?? nodes
  const rows = flattenToRows(roots)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "书签")
  return XLSX.write(wb, { bookType: "xlsx", type: "array" })
}

/** 递归转为可序列化的 JSON 结构 */
export function toExportJson(nodes: BookmarkTreeNode[]): Array<{
  id: string
  title: string
  url?: string
  dateAdded?: number
  children?: ReturnType<typeof toExportJson>
}> {
  return (nodes || []).filter((n) => n.id !== "0")
    .map((node) => ({
      id: node.id,
      title: node.title || "",
      url: node.url,
      dateAdded: node.dateAdded,
      children: node.children?.length ? toExportJson(node.children) : undefined,
    }))
}
