<template>
  <div class="bm-panel w-full h-full flex flex-col">
    <header class="bm-header neu-pressed-sm px-3 py-3 mb-3 neu-radius-sm">
      <div class="bm-brand flex items-center gap-2 mb-3">
        <span class="bm-brand-icon text-[1.1rem] text-[var(--el-color-primary)]">✦</span>
        <h1
          class="bm-title m-0 text-[1.05rem] font-600 tracking-wide text-[var(--el-text-color-primary)]"
        >
          书签
        </h1>
      </div>
      <div class="bm-toolbar grid grid-cols-3 gap-2">
        <button
          type="button"
          class="bm-btn bm-btn-ghost flex items-center justify-center gap-1.5 h-8 px-2 text-sm font-500 border-none cursor-pointer neu-radius-sm"
          :disabled="loading"
          title="刷新"
          @click="loadBookmarks"
        >
          <el-icon v-if="loading" class="is-loading bm-btn-icon"><Loading /></el-icon>
          <el-icon v-else class="bm-btn-icon"><Refresh /></el-icon>
          <span class="truncate">刷新</span>
        </button>
        <button
          type="button"
          class="bm-btn bm-btn-danger flex items-center justify-center gap-1.5 h-8 px-2 text-sm font-500 border-none cursor-pointer neu-radius-sm"
          :disabled="loading || !treeData.length"
          title="清空全部书签"
          @click="confirmClearAll"
        >
          <el-icon class="bm-btn-icon"><Delete /></el-icon>
          <span class="truncate">清空全部</span>
        </button>
        <el-dropdown
          trigger="click"
          @command="handleExport"
          popper-class="bm-export-popper"
          class="col-span-1"
        >
          <button
            type="button"
            class="bm-btn bm-btn-primary w-full flex items-center justify-center gap-1.5 h-8 px-2 text-sm font-500 border-none cursor-pointer neu-radius-sm"
          >
            <el-icon class="bm-btn-icon"><Download /></el-icon>
            <span class="truncate">导出</span>
            <el-icon class="bm-btn-chevron shrink-0"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="html">HTML</el-dropdown-item>
              <el-dropdown-item command="json">JSON</el-dropdown-item>
              <el-dropdown-item command="excel">Excel</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="bm-main flex-1 min-h-0 flex flex-col">
      <div class="bm-card neu-raised flex flex-col overflow-hidden h-full pb-1 neu-radius">
        <div class="bm-card-header px-3 py-3 text-sm font-600 text-[var(--el-text-color-primary)]">
          书签列表
        </div>
        <div
          v-if="loading"
          class="bm-state bm-state-loading flex flex-col items-center justify-center gap-2 py-10 text-sm text-[var(--el-text-color-secondary)]"
        >
          <div class="bm-spinner" />
          <span>加载中</span>
        </div>
        <div
          v-else-if="error"
          class="bm-state bm-state-error flex flex-col items-center justify-center gap-2 py-10 text-sm text-[var(--el-color-danger)]"
        >
          <span class="bm-state-icon text-2xl font-700">!</span>
          <span>{{ error }}</span>
        </div>
        <div
          v-else-if="!treeData.length"
          class="bm-state bm-state-empty flex flex-col items-center justify-center gap-2 py-10 text-sm text-[var(--el-text-color-secondary)]"
        >
          <span class="bm-state-icon text-2xl font-700 opacity-50">◇</span>
          <span>暂无书签</span>
        </div>
        <div v-else class="flex-1 h-0 overflow-hidden py-2 pl-2 pr-1">
          <el-tree
            :data="treeData"
            :props="{ label: 'label', children: 'children' }"
            node-key="id"
            default-expand-all
            highlight-current
            :indent="12"
            class="bm-tree overflow-auto"
          >
            <template #default="{ data }">
              <div
                class="bm-node flex items-center justify-between !w-full"
                @mouseenter="hoveredNodeId = data.id"
                @mouseleave="hoveredNodeId = null"
              >
                <div class="flex items-center w-0 flex-1 gap-1">
                  <div class="shrink-0 text-sm">
                    {{ data.isFolder ? "📁" : "🔗" }}
                  </div>
                  <div
                    class="bm-node-label text-sm w-0 flex-1 text-[var(--el-text-color-primary)] truncate"
                    :title="data.label"
                  >
                    {{ data.label }}
                  </div>
                </div>
                <div
                  class="bm-node-actions flex shrink-0 gap-1 transition-opacity duration-150"
                  :class="{ 'opacity-0 pointer-events-none': hoveredNodeId !== data.id }"
                >
                  <button
                    type="button"
                    class="bm-action inline-flex items-center justify-center w-[26px] h-[26px] p-0 border-none cursor-pointer transition-all duration-200 neu-radius-sm text-[var(--el-text-color-secondary)]"
                    @click.stop="openEdit(data)"
                    title="编辑"
                  >
                    <el-icon><Edit /></el-icon>
                  </button>
                  <button
                    type="button"
                    class="bm-action bm-action-danger inline-flex items-center justify-center w-[26px] h-[26px] p-0 border-none cursor-pointer transition-all duration-200 neu-radius-sm text-[var(--el-text-color-secondary)]"
                    @click.stop="confirmDelete(data)"
                    title="删除"
                  >
                    <el-icon><Delete /></el-icon>
                  </button>
                </div>
              </div>
            </template>
          </el-tree>
        </div>
      </div>
    </main>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="editVisible"
      :title="editingNode?.isFolder ? '重命名文件夹' : '重命名书签'"
      width="90%"
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
  toExportExcel,
  toExportJson,
  toNetscapeHtml,
  toTreeItems,
  type BookmarkTreeNode,
} from "@/utils/bookmarkAssistant"
import { ArrowDown, Delete, Download, Edit, Loading, Refresh } from "@element-plus/icons-vue"
import { ElMessage, ElMessageBox } from "element-plus"
import { onMounted, ref } from "vue"
import { browser } from "wxt/browser"

const loading = ref(false)
const error = ref("")
const rawTree = ref<BookmarkTreeNode[]>([])
const treeData = ref<BookmarkTreeItem[]>([])
const editVisible = ref(false)
const editingNode = ref<BookmarkTreeItem | null>(null)
const editForm = ref({ title: "", url: "" })
const hoveredNodeId = ref<string | null>(null)

function formatUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname || url.slice(0, 20)
  } catch {
    return url.slice(0, 20)
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
    const buf = toExportExcel(tree)
    downloadBlob(
      "bookmarks.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buf
    )
    ElMessage.success("已导出 Excel")
  }
}

function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  downloadBlob(filename, mime, blob)
}

function downloadBlob(filename: string, mime: string, content: Blob | Uint8Array) {
  const blob = content instanceof Blob ? content : new Blob([content as BlobPart], { type: mime })
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
/* 书签助手 - 拟态风格，按 DOM 父子层级组织 */
.bm-panel {
  color: var(--el-text-color-primary);

  .bm-header {
    .bm-btn-icon {
      font-size: 14px;
    }
    .bm-btn-chevron {
      font-size: 12px;
      margin-left: 2px;
      opacity: 0.9;
    }
    .bm-btn {
      background: var(--neu-surface);
      box-shadow: var(--neu-shadow-sm);
      transition: all var(--neu-transition);

      &:active:not(:disabled) {
        transform: scale(0.98);
        box-shadow: var(--neu-inset-sm);
      }

      &.bm-btn-ghost {
        color: var(--el-text-color-secondary);

        &:hover:not(:disabled) {
          color: var(--el-text-color-primary);
          box-shadow: var(--neu-shadow-md);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      &.bm-btn-primary {
        background: var(--el-color-primary);
        color: #fff;

        &:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: var(--neu-shadow-md);
        }
      }

      &.bm-btn-danger {
        background: var(--el-color-danger);
        color: #fff;

        &:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: var(--neu-shadow-md);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
  }

  .bm-main .bm-card {
    .bm-card-header {
      border-bottom: none;
      background: transparent;
    }

    .bm-state {
      .bm-state-icon {
        font-size: 28px;
        font-weight: 700;
        opacity: 0.5;
      }

      &.bm-state-loading .bm-spinner {
        width: 28px;
        height: 28px;
        border: 2px solid var(--neu-shadow-dark);
        border-top-color: var(--el-color-primary);
        border-radius: 50%;
        animation: bm-spin 0.7s linear infinite;
      }

      &.bm-state-error .bm-state-icon {
        color: var(--el-color-danger);
        opacity: 1;
      }
    }

    .bm-tree {
      height: 100%;
      overflow-y: auto;
      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--neu-shadow-dark);
        border-radius: 3px;
      }
      :deep(.el-tree) {
        background: transparent;
      }

      :deep(.el-tree-node__content) {
        height: auto;
        min-height: 38px;
        padding: 0 12px;
        margin: 0 4px;
        background: transparent !important;
        border-radius: var(--neu-radius-sm);
        transition: all var(--neu-transition);

        &:hover {
          background: var(--neu-surface) !important;
          box-shadow: var(--neu-inset-sm);
        }
      }

      :deep(.el-tree-node.is-current > .el-tree-node__content) {
        background: var(--neu-surface) !important;
        box-shadow: var(--neu-inset-sm);
      }

      :deep(.el-tree-node__expand-icon) {
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }

      .bm-node {
        .bm-action {
          background: transparent;

          &:hover {
            background: var(--neu-surface);
            color: var(--el-text-color-primary);
            box-shadow: var(--neu-inset-sm);
          }

          &.bm-action-danger:hover {
            background: rgba(245, 108, 108, 0.15);
            color: var(--el-color-danger);
          }
        }
      }
    }
  }
}

@keyframes bm-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style lang="scss">
/* 导出下拉菜单 - 拟态风格（popper 渲染在 body 下） */
.bm-export-popper.el-dropdown__popper {
  .el-dropdown-menu {
    background: var(--neu-surface);
    border: none;
    box-shadow: var(--neu-shadow-lg);
    border-radius: var(--neu-radius-sm);
    padding: 6px 0;
    overflow: hidden;
  }
  .el-dropdown-menu__item {
    color: var(--el-text-color-primary);
    font-size: 14px;
    margin: 0 4px;
    border-radius: var(--neu-radius-sm);

    &:hover {
      background: var(--neu-surface);
      box-shadow: var(--neu-inset-sm);
      color: var(--el-color-primary);
    }
  }
}
</style>
