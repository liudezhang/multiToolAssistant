import { describe, expect, test } from "bun:test"
import {
  flattenBookmarks,
  toExportExcel,
  toExportJson,
  toNetscapeHtml,
  toTreeItems,
  type BookmarkTreeNode,
} from "../src/utils/bookmarkAssistant"

/** 构造一棵和浏览器 bookmarks.getTree() 同构的小树 */
const tree: BookmarkTreeNode[] = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        parentId: "0",
        title: "书签栏",
        dateAdded: 1700000000000,
        children: [
          {
            id: "10",
            parentId: "1",
            title: "A & B <tools>",
            url: "https://example.com/?a=1&b=2",
            dateAdded: 1700000000000,
          },
          {
            id: "11",
            parentId: "1",
            title: "文件夹",
            dateAdded: 1700000000000,
            children: [
              {
                id: "110",
                parentId: "11",
                title: "嵌套",
                url: "https://nested.example.com/",
                dateAdded: 1700000000000,
              },
            ],
          },
        ],
      },
    ],
  },
]

describe("toTreeItems", () => {
  test("过滤根节点并标记文件夹", () => {
    const roots = tree[0]!.children!
    const items = toTreeItems(roots)
    expect(items).toHaveLength(1)
    expect(items[0]!.isFolder).toBe(true)
    expect(items[0]!.children?.[0]?.isFolder).toBe(false)
    expect(items[0]!.children?.[1]?.isFolder).toBe(true)
  })

  test("空入参返回空数组", () => {
    expect(toTreeItems(undefined)).toEqual([])
    expect(toTreeItems([])).toEqual([])
  })
})

describe("flattenBookmarks", () => {
  test("只收集带 URL 的节点（含嵌套），并保留 parentId", () => {
    const flat = flattenBookmarks(tree[0]!.children)
    expect(flat.map((item) => item.id)).toEqual(["10", "110"])
    expect(flat[1]!.parentId).toBe("11")
  })
})

describe("toNetscapeHtml", () => {
  test("标题与 URL 中的 & < > 被转义", () => {
    const html = toNetscapeHtml(tree)
    expect(html).toContain("<title>书签导出</title>")
    expect(html).toContain("A &amp; B &lt;tools&gt;")
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"')
    // 不能出现未转义的原始标签
    expect(html).not.toContain("<tools>")
  })
})

describe("toExportJson", () => {
  test("剔除根节点，保留嵌套结构", () => {
    const json = toExportJson(tree[0]!.children!)
    expect(json).toHaveLength(1)
    expect(json[0]!.title).toBe("书签栏")
    expect(json[0]!.children?.[1]?.children?.[0]?.url).toBe("https://nested.example.com/")
  })
})

describe("toExportExcel", () => {
  test("动态加载 xlsx 后产出 xlsx（zip 头 PK）", async () => {
    const buf = await toExportExcel(tree)
    const bytes = new Uint8Array(buf)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })
})
