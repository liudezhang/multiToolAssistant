<template>
  <div class="cache-content flex flex-col h-full">
    <!-- 当前站点 -->
    <div class="site shrink-0 px-4 py-3">
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="meta shrink-0">当前站点</span>
        <span class="site-host tabular">{{ currentHost || "—" }}</span>
      </div>
      <p class="m-0 mt-1 meta">指定并缓存页面 storage 字段，方便切换用户测试</p>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto px-4">
      <!-- 监听的字段 -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">监听的字段</h2>
          <span v-if="watchedKeys.length" class="meta tabular">{{ watchedKeys.length }} 个</span>
        </div>

        <div class="flex gap-2">
          <el-input v-model.trim="newKey" placeholder="键名，如 token" @keyup.enter="handleAddKey" />
          <el-button type="primary" :disabled="!newKey.trim()" @click="handleAddKey">添加</el-button>
        </div>

        <div class="type-row">
          <span class="meta shrink-0">写入</span>
          <el-radio-group v-model="newKeyStorageType">
            <el-radio-button value="localStorage">localStorage</el-radio-button>
            <el-radio-button value="sessionStorage">sessionStorage</el-radio-button>
          </el-radio-group>
        </div>

        <ul v-if="watchedKeys.length" class="rows m-0 p-0 list-none">
          <li v-for="item in watchedKeys" :key="item.key" class="row">
            <span class="row-key" :title="item.key">{{ item.key }}</span>
            <span class="source">
              <i
                class="dot"
                :class="item.storageType === 'localStorage' ? 'dot-accent' : 'dot-warning'"
              />
              {{ item.storageType === "localStorage" ? "local" : "session" }}
            </span>
            <el-button
              :icon="Delete"
              text
              circle
              size="small"
              :aria-label="`移除监听字段 ${item.key}`"
              @click="handleRemoveKey(item.key)"
            />
          </li>
        </ul>
        <p v-else class="empty">还没有监听字段，先添加要缓存的键名</p>
      </section>

      <!-- 保存当前页面 -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">保存当前页面</h2>
          <el-button
            v-if="watchedKeys.length"
            text
            size="small"
            :icon="Refresh"
            @click="loadCurrentData"
          >
            刷新
          </el-button>
        </div>

        <p v-if="!watchedKeys.length" class="empty">先添加监听的键名</p>
        <template v-else>
          <div class="well px-2.5 py-1 mb-2">
            <p v-if="isEmptyObject(displayData)" class="empty">暂无数据</p>
            <template v-else>
              <div v-for="(value, key) in displayData" :key="key" class="row">
                <span class="row-key" :title="key">{{ key }}</span>
                <span class="row-value" :title="formatValue(value)">
                  <el-tag v-if="value === null" type="info" size="small">null</el-tag>
                  <el-tag v-else-if="value === undefined" type="info" size="small">undefined</el-tag>
                  <el-tag v-else-if="value === ''" type="info" size="small">空</el-tag>
                  <template v-else>{{ formatValue(value) }}</template>
                </span>
                <span class="source" :title="getSourceLabel(currentData, key)">
                  <i class="dot" :class="`dot-${getSourceTone(currentData, key)}`" />
                  {{ getSourceLabel(currentData, key) }}
                </span>
                <el-button
                  :icon="View"
                  text
                  circle
                  size="small"
                  aria-label="查看完整内容"
                  @click="openViewer(key, value)"
                />
              </div>
            </template>
          </div>

          <div class="flex gap-2">
            <el-input v-model.trim="configName" placeholder="给这份快照起个名字" />
            <el-button type="primary" :disabled="!configName.trim()" @click="handleSaveConfig">
              保存
            </el-button>
          </div>
        </template>
      </section>

      <!-- 已保存的配置 -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">已保存的配置</h2>
          <span v-if="configList.length" class="meta tabular">{{ configList.length }} 条</span>
        </div>

        <ul v-if="configList.length" class="rows m-0 p-0 list-none">
          <li v-for="config in configList" :key="config.id" class="row">
            <div class="config-main">
              <span class="config-name" :title="config.name">{{ config.name }}</span>
              <span class="meta tabular">
                {{ getDataKeysCount(config.data) }} 个键 · {{ formatDate(config.createdAt) }}
              </span>
            </div>
            <el-button type="primary" plain size="small" @click="handleLoadConfig(config.id)">
              应用
            </el-button>
            <el-button
              :icon="Delete"
              text
              circle
              size="small"
              :aria-label="`删除配置 ${config.name}`"
              @click="confirmDelete(config.id, config.name)"
            />
          </li>
        </ul>
        <p v-else class="empty">暂无配置，保存后按站点显示</p>
      </section>
    </div>

    <!-- 查看完整内容 -->
    <el-dialog
      v-model="viewerVisible"
      :title="`查看: ${viewerKey}`"
      width="92%"
      class="viewer-dialog"
      destroy-on-close
      @closed="viewerKey = ''"
    >
      <pre class="viewer">{{ viewerContent }}</pre>
      <template #footer>
        <el-button @click="viewerVisible = false">关闭</el-button>
        <el-button type="primary" @click="copyValue(viewerContent)">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 缓存助手核心组件：
 * - 监听字段管理（localStorage/sessionStorage 键名）
 * - 保存当前页面 storage 快照为配置
 * - 应用/删除已保存配置
 * 通过 utils/messaging 的 sendMessage 与 background 通信
 */
import type { StorageConfig, StorageData, StorageType, WatchedKey } from "@/types"
import { getDataKeysCount, getSourceLabel, getSourceTone } from "@/utils/cacheAssistant"
import { formatDate, formatValue } from "@/utils/format"
import { sendMessage } from "@/utils/messaging"
import { Delete, Refresh, View } from "@element-plus/icons-vue"
import { useClipboard, useToggle } from "@vueuse/core"
import { omitBy } from "es-toolkit/object"
import { isEmptyObject } from "es-toolkit/predicate"
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

const newKey = ref("")
const newKeyStorageType = ref<StorageType>("localStorage")
const configName = ref("")
const watchedKeys = ref<WatchedKey[]>([])
const currentData = ref<StorageData>({})
const configs = ref<Record<string, StorageConfig>>({})
const currentHost = ref("")
const [viewerVisible, toggleViewer] = useToggle(false)
const viewerKey = ref("")
const viewerContent = ref("")

// 配置列表按创建时间倒序
const configList = computed(() =>
  Object.values(configs.value).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
)

// 展示数据时过滤掉 _source 元数据字段
const displayData = computed(() =>
  omitBy(currentData.value, (_, key) => String(key).endsWith("_source"))
)

let refreshPort: ReturnType<typeof browser.runtime.connect> | null = null

async function refreshData() {
  await loadCurrentTabUrl()
  await loadWatchedKeys()
  await loadConfigs()
  await loadCurrentData()
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") refreshData()
}

onMounted(async () => {
  await refreshData()

  // 连接 background，接收页面刷新通知后刷新数据
  refreshPort = browser.runtime.connect({ name: "sidepanel" })
  refreshPort.onMessage.addListener(async (msg: { type?: string }) => {
    if (msg?.type === "PAGE_REFRESHED") await refreshData()
  })

  // 侧边栏重新可见时刷新（如切换账号后切回浏览器，此时 storage 可能已变）
  document.addEventListener("visibilitychange", onVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibilityChange)
  refreshPort?.disconnect()
})

async function loadCurrentTabUrl() {
  try {
    const res = await sendMessage("GET_CURRENT_TAB_URL")
    if (res.success) currentHost.value = res.hostname
  } catch {
    /* 无可用标签页时忽略 */
  }
}

async function loadWatchedKeys() {
  try {
    const res = await sendMessage("GET_WATCHED_KEYS")
    if (res.success) watchedKeys.value = res.keys ?? []
  } catch {
    ElMessage.error("加载键名失败")
  }
}

async function loadCurrentData() {
  if (watchedKeys.value.length === 0) {
    currentData.value = {}
    return
  }
  try {
    const res = await sendMessage("GET_STORAGE_DATA", { items: watchedKeys.value })
    if (res.success) {
      currentData.value = res.data ?? {}
    } else {
      ElMessage.error(res.error || "获取数据失败")
    }
  } catch {
    ElMessage.error("获取数据失败，请确保已打开目标网页")
  }
}

async function loadConfigs() {
  try {
    const res = await sendMessage("GET_ALL_CONFIGS")
    if (res.success) configs.value = res.configs ?? {}
  } catch {
    ElMessage.error("加载配置失败")
  }
}

async function handleAddKey() {
  const key = newKey.value.trim()
  if (!key) {
    ElMessage.warning("请输入键名")
    return
  }
  if (watchedKeys.value.some((item) => item.key === key)) {
    ElMessage.warning("该键名已存在")
    return
  }
  try {
    const res = await sendMessage("ADD_WATCHED_KEY", {
      key,
      storageType: newKeyStorageType.value,
    })
    if (res.success) {
      await loadWatchedKeys()
      await loadCurrentData()
      newKey.value = ""
      ElMessage.success("添加成功")
    } else {
      ElMessage.error(res.error || "添加失败")
    }
  } catch {
    ElMessage.error("添加失败")
  }
}

async function handleRemoveKey(key: string) {
  try {
    await ElMessageBox.confirm(`确定要移除监听字段 "${key}" 吗？`, "确认移除", {
      confirmButtonText: "移除",
      cancelButtonText: "取消",
      type: "warning",
    })
    const res = await sendMessage("REMOVE_WATCHED_KEY", { key })
    if (res.success) {
      await loadWatchedKeys()
      await loadCurrentData()
      ElMessage.success("移除成功")
    } else {
      ElMessage.error(res.error || "移除失败")
    }
  } catch (e) {
    if (e !== "cancel") ElMessage.error("移除失败")
  }
}

async function handleSaveConfig() {
  const name = configName.value.trim()
  if (!name) {
    ElMessage.warning("请输入配置名称")
    return
  }
  try {
    await loadCurrentData() // 保存前自动刷新，确保保存最新数据
    const res = await sendMessage("SAVE_CONFIG", { name, data: currentData.value })
    if (res.success) {
      await loadConfigs()
      configName.value = ""
      ElMessage.success("保存成功")
    } else {
      ElMessage.error(res.error || "保存失败")
    }
  } catch {
    ElMessage.error("保存失败")
  }
}

async function handleLoadConfig(configId: string) {
  const config = configs.value[configId]
  if (!config) return
  try {
    const res = await sendMessage("SET_STORAGE_DATA", { data: config.data })
    if (res.success) {
      await loadCurrentData()
      ElMessage.success("配置已应用，刷新页面后生效")
    } else {
      ElMessage.error(res.error || "应用配置失败")
    }
  } catch {
    ElMessage.error("应用配置失败")
  }
}

async function confirmDelete(configId: string, configTitle: string) {
  try {
    await ElMessageBox.confirm(`确定要删除配置 "${configTitle}" 吗？此操作无法撤销。`, "确认删除", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    })
    const res = await sendMessage("DELETE_CONFIG", { configId })
    if (res.success) {
      await loadConfigs()
      ElMessage.success("删除成功")
    } else {
      ElMessage.error(res.error || "删除失败")
    }
  } catch (e) {
    if (e !== "cancel") ElMessage.error("删除失败")
  }
}

function openViewer(key: string, value: unknown) {
  viewerKey.value = key
  viewerContent.value = formatValue(value)
  toggleViewer(true)
}

const { copy } = useClipboard()
async function copyValue(text: string) {
  try {
    await copy(text)
    ElMessage.success("已复制")
  } catch {
    ElMessage.error("复制失败")
  }
}
</script>

<style lang="scss" scoped>
.cache-content {
  background: var(--surface);

  .site {
    border-bottom: 1px solid var(--border);

    .site-host {
      min-width: 0;
      overflow: hidden;
      font-size: 15px;
      font-weight: 600;
      color: var(--accent);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .site .meta {
    color: var(--el-text-color-secondary);
  }

  .section {
    padding-block: 16px;

    & + .section {
      border-top: 1px solid var(--border);
    }
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 22px;
    margin-bottom: 10px;
  }

  .section-title {
    margin: 0;
    font-size: var(--el-font-size-base);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .type-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .empty {
    margin: 0;
    padding: 14px 0;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .rows {
    margin-top: 4px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 2px 0;

    & + .row {
      border-top: 1px solid var(--border);
    }

    // EP 默认给相邻按钮加 margin-left，与 flex gap 叠加会变成双倍间距
    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }

  .row-key {
    flex: 0 1 auto;
    max-width: 45%;
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: var(--el-font-size-extra-small);
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
  }

  .dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;

    &.dot-accent {
      background: var(--accent);
    }

    &.dot-warning {
      background: #b25e09;
    }

    &.dot-muted {
      background: var(--gray-400);
    }
  }

  .config-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .config-name {
    overflow: hidden;
    font-size: var(--el-font-size-base);
    font-weight: 500;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .viewer {
    max-height: 55vh;
    margin: 0;
    padding: 10px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: var(--el-font-size-extra-small);
    line-height: 1.6;
    color: var(--el-text-color-regular);
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--surface-muted);
    border-radius: var(--radius-md);
  }
}
</style>
