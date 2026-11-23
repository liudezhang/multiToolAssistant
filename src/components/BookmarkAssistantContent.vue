<template>
  <div class="bm-panel flex flex-col h-full">
    <!-- 工具栏 -->
    <div class="toolbar shrink-0 grid grid-cols-2 gap-2 px-4 py-3">
      <el-button :icon="Refresh" :loading="loading" class="w-full" @click="loadBookmarks">
        刷新
      </el-button>
      <el-button
        :icon="Picture"
        :loading="fixingIcons"
        :disabled="loading || fixingIcons || !treeData.length"
        class="w-full"
        title="仅对无图标的书签，后台访问网站以触发图标更新"
        @click="fixBookmarkIcons"
      >
        修复图标
      </el-button>
      <el-button
        type="danger"
        plain
        :icon="Delete"
        :disabled="loading || !treeData.length"
        class="w-full"
        @click="confirmClearAll"
      >
        清空全部
      </el-button>
      <el-dropdown trigger="click" class="w-full" @command="handleExport">
        <el-button type="primary" :icon="Download" class="w-full">导出</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="html">导出 HTML</el-dropdown-item>
            <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
            <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 书签列表 -->
    <div class="list flex-1 min-h-0 flex flex-col border-t border-[var(--border)]">
      <div class="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 class="section-title">书签列表</h2>
      </div>

      <div v-if="loading" class="state">
        <el-icon class="state-icon is-loading"><Loading /></el-icon>
        <span>加载中</span>
      </div>
      <div v-else-if="error" class="state state-error">
        <el-icon class="state-icon"><CircleClose /></el-icon>
        <span>{{ error }}</span>
      </div>
      <div v-else-if="!treeData.length" class="state">
        <el-icon class="state-icon"><Collection /></el-icon>
        <span>暂无书签</span>
      </div>

      <div v-else class="tree-wrap flex-1 min-h-0 px-2 pb-2">
        <el-tree
          :data="treeData"
          :props="{ label: 'label', children: 'children' }"
          node-key="id"
          default-expand-all
          highlight-current
          :indent="10"
          class="bm-tree"
        >
          <template #default="{ data }">
            <div class="bm-node">
              <el-icon class="node-icon">
                <Folder v-if="data.isFolder" />
                <Link v-else />
              </el-icon>
              <span class="node-label" :title="data.label">{{ data.label }}</span>
              <span class="node-actions">
                <el-button
                  :icon="Edit"
                  text
                  circle
                  size="small"
                  :aria-label="`编辑 ${data.label}`"
                  @click.stop="openEdit(data)"
                />
                <el-button
                  :icon="Delete"
                  text
                  circle
                  size="small"
                  class="danger"
                  :aria-label="`删除 ${data.label}`"
                  @click.stop="confirmDelete(data)"
                />
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="editVisible"
      :title="editingNode?.isFolder ? '重命名文件夹' : '重命名书签'"
      width="92%"
      destroy-on-close
      @closed="editingNode = null"
    >
      <el-form label-width="auto">
        <el-form-item label="名称">
          <el-input
            v-model.trim="editForm.title"
            placeholder="输入新名称"
            type="textarea"
            :rows="2"
            @keyup.enter="submitEdit"
          />
        </el-form-item>
        <el-form-item v-if="!editingNode?.isFolder" label="URL">
          <el-input
            v-model.trim="editForm.url"
            placeholder="输入新 URL"
            type="textarea"
            :rows="3"
            @keyup.enter="submitEdit"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 书签助手核心组件：
 * - 查看书签树
 * - 修改（重命名、删除）
 * - 导出 HTML / JSON / Excel
 */
import type { BookmarkTreeItem } from "@/utils/bookmarkAssistant"
import {
  flattenBookmarks,
  toExportExcel,
  toExportJson,
  toNetscapeHtml,
  toTreeItems,
  type BookmarkTreeNode,
} from "@/utils/bookmarkAssistant"
import {
  CircleClose,
  Collection,
  Delete,
  Download,
  Edit,
  Folder,
  Link,
  Loading,
  Picture,
  Refresh,
} from "@element-plus/icons-vue"
import { onMounted, ref } from "vue"
import { browser } from "wxt/browser"

const loading = ref(false)
const fixingIcons = ref(false)
const error = ref("")
const rawTree = ref<BookmarkTreeNode[]>([])
const treeData = ref<BookmarkTreeItem[]>([])
const editVisible = ref(false)
const editingNode = ref<BookmarkTreeItem | null>(null)
const editForm = ref({ title: "", url: "" })

/** 判断 URL 是否可在普通标签页中打开（用于触发 favicon 获取） */
function isVisitableUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** 获取 favicon 的 ImageData（用于判断是否为默认图标） */
function getFaviconImageData(url: string): Promise<ImageData | null> {
  // _favicon 是浏览器内置资源，不在 WXT 的公开资源路径类型内，故基于扩展 origin 拼接
  const extensionOrigin = new URL(browser.runtime.getURL("/sidepanel.html")).origin
  const faviconUrl = new URL("/_favicon/", extensionOrigin)
  faviconUrl.searchParams.set("pageUrl", url)
  faviconUrl.searchParams.set("size", "32")
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, 32, 32))
    }
    img.onerror = () => resolve(null)
    img.src = faviconUrl.toString()
  })
}

/** 比较两个 ImageData 是否相同 */
function imageDataEqual(a: ImageData, b: ImageData): boolean {
  if (a.data.length !== b.data.length) return false
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) return false
  }
  return true
}

/** 判断 URL 是否没有 favicon（显示为默认图标） */
async function hasNoFavicon(url: string, defaultFaviconData: ImageData): Promise<boolean> {
  const data = await getFaviconImageData(url)
  return data !== null && imageDataEqual(data, defaultFaviconData)
}

/** 等待标签页加载完成（或超时） */
async function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  try {
    const tab = await browser.tabs.get(tabId)
    if (tab.status === "complete") return
  } catch {
    return
  }
  return new Promise((resolve) => {
    const listener = (id: number, changeInfo: { status?: string }) => {
      if (id === tabId && changeInfo.status === "complete") {
        browser.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    browser.tabs.onUpdated.addListener(listener)
    setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener)
      resolve()
    }, timeoutMs)
  })
}

async function fixBookmarkIcons() {
  const tree = rawTree.value
  if (!tree.length) return
  const roots = tree[0]?.children ?? tree
  const leaves = flattenBookmarks(roots).filter((bm) => bm.url && isVisitableUrl(bm.url))
  const uniqueByUrl = Array.from(new Map(leaves.map((bm) => [bm.url!, bm])).values())
  if (!uniqueByUrl.length) {
    ElMessage.warning("没有可修复的书签（仅支持 http/https 链接）")
    console.warn("[书签助手] 修复图标：没有可修复的书签")
    return
  }
  fixingIcons.value = true
  try {
    ElMessage.info("正在检测缺少图标的书签…")
    const defaultData = await getFaviconImageData("https://invalid.invalid")
    if (!defaultData) {
      ElMessage.warning("无法获取默认图标参考，将处理全部书签")
      console.warn("[书签助手] 无法获取默认 favicon 参考")
    }
    const toFix: typeof uniqueByUrl = []
    for (const bm of uniqueByUrl) {
      const isDefault = defaultData ? await hasNoFavicon(bm.url!, defaultData) : true
      if (isDefault) toFix.push(bm)
    }
    if (!toFix.length) {
      ElMessage.success("所有书签均有图标，无需修复")
      console.log("[书签助手] 修复图标：全部书签已有图标")
      return
    }
    console.log(`[书签助手] 检测到 ${toFix.length} 个无图标书签，共 ${uniqueByUrl.length} 个`)
    ElMessage.info(`发现 ${toFix.length} 个无图标书签，开始访问…`)
    const BATCH_SIZE = 5
    const FAVICON_EXTRA_MS = 2500
    const LOAD_TIMEOUT_MS = 20000
    let successCount = 0
    let failCount = 0
    for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
      const batch = toFix.slice(i, i + BATCH_SIZE)
      const tabIds: number[] = []
      for (const bm of batch) {
        try {
          const tab = await browser.tabs.create({ url: bm.url!, active: false })
          tabIds.push(tab.id!)
        } catch (err) {
          failCount++
          console.error(`[书签助手] 打开失败：「${bm.title}」${bm.url}`, err)
        }
      }
      successCount += tabIds.length
      await Promise.all(tabIds.map((id) => waitForTabComplete(id, LOAD_TIMEOUT_MS)))
      await new Promise((r) => setTimeout(r, FAVICON_EXTRA_MS))
      for (const id of tabIds) {
        try {
          await browser.tabs.remove(id)
        } catch {
          /* 标签页可能已被用户关闭 */
        }
      }
    }
    ElMessage.success(`已访问 ${successCount} 个无图标网站，图标将逐步更新`)
    console.log(`[书签助手] 修复图标成功：已访问 ${successCount} 个无图标书签`)
    if (failCount > 0) {
      ElMessage.warning(`有 ${failCount} 个无法打开，详见控制台`)
      console.warn(`[书签助手] 修复图标失败：${failCount} 个`)
    }
    await loadBookmarks()
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修复图标失败"
    ElMessage.error(msg)
    console.error("[书签助手] 修复图标异常", e)
  } finally {
    fixingIcons.value = false
  }
}

async function loadBookmarks() {
  loading.value = true
  error.value = ""
  try {
    const tree = await browser.bookmarks.getTree()
    rawTree.value = tree
    const roots = tree[0]?.children ?? tree
    treeData.value = toTreeItems(roots)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载书签失败"
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

function openEdit(node: BookmarkTreeItem) {
  editingNode.value = node
  editForm.value = {
    title: node.label,
    url: node.url || "",
  }
  editVisible.value = true
}

async function submitEdit() {
  if (!editingNode.value) return
  const { title, url } = editForm.value
  if (!title.trim()) {
    ElMessage.warning("请输入名称")
    return
  }
  if (!editingNode.value.isFolder && !url.trim()) {
    ElMessage.warning("请输入 URL")
    return
  }
  try {
    const changes: { title?: string; url?: string } = { title: title.trim() }
    if (!editingNode.value.isFolder) changes.url = url.trim()
    await browser.bookmarks.update(editingNode.value.id, changes)
    ElMessage.success("已保存")
    editVisible.value = false
    await loadBookmarks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败")
  }
}

async function confirmDelete(node: BookmarkTreeItem) {
  const type = node.isFolder ? "文件夹" : "书签"
  try {
    await ElMessageBox.confirm(
      `确定要删除${type}「${node.label}」吗？${node.isFolder ? "其下所有子书签也会被删除。" : ""}`,
      "确认删除",
      { confirmButtonText: "删除", cancelButtonText: "取消", type: "warning" }
    )
    if (node.isFolder) {
      await browser.bookmarks.removeTree(node.id)
    } else {
      await browser.bookmarks.remove(node.id)
    }
    ElMessage.success("已删除")
    await loadBookmarks()
  } catch (e) {
    if (e !== "cancel") ElMessage.error(e instanceof Error ? e.message : "删除失败")
  }
}

async function confirmClearAll() {
  if (!treeData.value.length) return
  try {
    await ElMessageBox.confirm(
      "确定要清空所有书签吗？此操作不可恢复，建议先导出备份。",
      "清空全部书签",
      { confirmButtonText: "清空", cancelButtonText: "取消", type: "warning" }
    )
    loading.value = true
    error.value = ""
    const tree = await browser.bookmarks.getTree()
    const roots = tree[0]?.children ?? tree
    for (const root of roots) {
      if (root.id === "0") continue
      const children = root.children ?? []
      for (const child of [...children]) {
        if (child.url) {
          await browser.bookmarks.remove(child.id)
        } else {
          await browser.bookmarks.removeTree(child.id)
        }
      }
    }
    ElMessage.success("已清空所有书签")
    await loadBookmarks()
  } catch (e) {
    if (e !== "cancel") ElMessage.error(e instanceof Error ? e.message : "清空失败")
  } finally {
    loading.value = false
  }
}

function handleExport(format: "html" | "json" | "excel") {
  if (!rawTree.value.length) {
    ElMessage.warning("暂无书签可导出")
    return
  }
  const tree = rawTree.value
  if (format === "html") {
    const html = toNetscapeHtml(tree)
    downloadFile("bookmarks.html", "text/html;charset=utf-8", html)
    ElMessage.success("已导出 HTML")
  } else if (format === "json") {
    const roots = tree[0]?.children ?? tree
    const json = toExportJson(roots)
    const str = JSON.stringify(json, null, 2)
    downloadFile("bookmarks.json", "application/json;charset=utf-8", str)
    ElMessage.success("已导出 JSON")
  } else {
    void exportExcel(tree)
  }
}

/** Excel 导出需动态加载 xlsx，单独处理异步失败 */
async function exportExcel(tree: BookmarkTreeNode[]) {
  try {
    const buf = await toExportExcel(tree)
    downloadBlob(
      "bookmarks.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buf
    )
    ElMessage.success("已导出 Excel")
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "导出 Excel 失败")
  }
}

function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  downloadBlob(filename, mime, blob)
}

function downloadBlob(filename: string, mime: string, content: Blob | ArrayBuffer) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => loadBookmarks())
</script>

<style lang="scss" scoped>
.bm-panel {
  background: var(--surface);

  > .toolbar :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .section-title {
    margin: 0;
    font-size: var(--el-font-size-base);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .state {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 0;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);

    .state-icon {
      font-size: 20px;
      color: var(--el-text-color-placeholder);
    }

    &.state-error {
      color: var(--el-color-danger);

      .state-icon {
        color: var(--el-color-danger);
      }
    }
  }

  .bm-tree {
    height: 100%;
    overflow-y: auto;
    background: transparent;

    :deep(.el-tree-node__content) {
      height: 34px;
      padding-right: 8px;
      border-radius: var(--radius-sm);
      transition: background-color var(--motion-fast) var(--ease);

      &:hover {
        background: var(--surface-hover);
      }
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background: var(--accent-soft);
    }

    :deep(.el-tree-node__expand-icon) {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }

  .bm-node {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;

    .node-icon {
      flex-shrink: 0;
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }

    .node-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: var(--el-font-size-base);
      color: var(--el-text-color-primary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* 行内操作：hover / 键盘聚焦时出现，触屏设备常显（不能只靠 hover） */
    .node-actions {
      display: flex;
      flex-shrink: 0;
      gap: 2px;
      opacity: 0;
      transition: opacity var(--motion-fast) var(--ease);

      :deep(.el-button + .el-button) {
        margin-left: 0;
      }

      .danger:hover {
        color: var(--el-color-danger);
      }
    }

    &:hover .node-actions,
    &:focus-within .node-actions {
      opacity: 1;
    }

    @media (hover: none) {
      .node-actions {
        opacity: 1;
      }
    }
  }
}
</style>
