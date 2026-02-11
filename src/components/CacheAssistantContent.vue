<template>
  <div class="content px-2 pb-2">
    <div class="flex items-center justify-between">
      <h1 class="title m-0 mb-2 text-lg font-600 text-[var(--el-text-color-primary)]">缓存助手</h1>
      <slot name="header-actions"></slot>
    </div>

    <!-- 当前站点 -->
    <div class="site-info mb-4">
      <p class="m-0 mb-1 text-[var(--el-font-size-small)] text-[var(--el-text-color-secondary)]">
        当前站点:
        <span class="text-[var(--el-color-primary)] font-600 text-base">{{
          currentHost || "—"
        }}</span>
      </p>
      <p class="m-0 text-[var(--el-font-size-extra-small)] text-[var(--el-text-color-placeholder)]">
        指定并缓存页面 storage 字段, 方便切换用户测试
      </p>
    </div>

    <!-- 监听的字段 -->
    <el-card class="section-card mb-4">
      <template #header>
        <span class="section-title"> <span class="bullet" />监听的字段 </span>
      </template>
      <div
        class="section-desc mb-3 text-[var(--el-font-size-small)] text-[var(--el-text-color-placeholder)]"
      >
        添加需要保存的 localStorage / sessionStorage 键名
      </div>
      <div class="flex gap-2 mb-3 flex-wrap items-center">
        <el-radio-group v-model="newKeyStorageType">
          <el-radio value="localStorage">localStorage</el-radio>
          <el-radio value="sessionStorage">sessionStorage</el-radio>
        </el-radio-group>

        <div class="flex w-full gap-2 items-center justify-between">
          <el-input
            v-model.trim="newKey"
            placeholder="如 token、userinfo"
            @keyup.enter="handleAddKey"
          />

          <el-button type="primary" @click="handleAddKey" :disabled="!newKey.trim()">
            添加
          </el-button>
        </div>
      </div>
      <div
        v-if="watchedKeys.length === 0"
        class="empty-hint text-center py-6 text-[var(--el-font-size-small)] text-[var(--el-text-color-placeholder)]"
      >
        暂无监听字段
      </div>
      <div v-else class="keys-list flex flex-col gap-2 px-1">
        <div
          v-for="item in watchedKeys"
          :key="item.key"
          class="key-item flex justify-between items-center rounded border border-[var(--el-border-color-extra-light)]"
        >
          <span class="font-mono text-[var(--el-font-size-small)] truncate font-600">{{
            item.key
          }}</span>
          <div class="flex items-center gap-2">
            <el-tag :type="item.storageType === 'localStorage' ? 'success' : 'warning'">
              {{ item.storageType }}
            </el-tag>
            <el-button
              type="danger"
              :icon="Delete"
              text
              circle
              @click="handleRemoveKey(item.key)"
            />
          </div>
        </div>
      </div>
    </el-card>

    <!-- 保存当前页面 -->
    <el-card class="section-card mb-4">
      <template #header>
        <span class="section-title"> <span class="bullet" />保存当前页面 </span>
      </template>
      <div
        v-if="watchedKeys.length === 0"
        class="empty-hint text-center py-4 text-[var(--el-font-size-small)] text-[var(--el-text-color-placeholder)]"
      >
        请先添加监听的键名
      </div>
      <template v-else>
        <div class="flex justify-between items-center mb-3">
          <span class="text-[var(--el-font-size-small)] text-[var(--el-text-color-secondary)]">
            当前监听的键名: {{ watchedKeys.length }} 个
          </span>
          <el-button type="primary" :icon="Refresh" @click="loadCurrentData"> 刷新数据 </el-button>
        </div>
        <div
          class="data-preview mb-3 overflow-y-auto rounded border border-[var(--el-border-color-extra-light)]"
        >
          <div
            v-if="isEmptyObject(displayData)"
            class="flex justify-center items-center py-8 text-[var(--el-font-size-small)] text-[var(--el-text-color-placeholder)]"
          >
            暂无数据
          </div>
          <div v-else class="data-container py-2 flex flex-col gap-2">
            <div
              v-for="(value, key) in displayData"
              :key="key"
              class="data-item flex gap-2 py-2 px-2 rounded border border-[var(--el-border-color-extra-light)] items-center"
            >
              <div
                class="data-key font-mono text-[var(--el-font-size-small)] font-600 text-[var(--el-text-color-primary)] shrink-0 truncate"
                :title="key"
              >
                {{ key }}
              </div>
              <div
                class="data-value font-mono text-[var(--el-font-size-extra-small)] text-[var(--el-text-color-regular)] truncate flex-1 min-w-0"
                :title="formatValue(value)"
              >
                <el-tag v-if="value === null" type="info">null</el-tag>
                <el-tag v-else-if="value === undefined" type="info">undefined</el-tag>
                <el-tag v-else-if="value === ''" type="info">空</el-tag>
                <span v-else>{{ formatValue(value) }}</span>
              </div>
              <div class="data-actions flex shrink-0 gap-1 items-center">
                <el-button :icon="View" link type="primary" @click="openViewer(key, value)" />
                <el-tag :type="getSourceType(currentData, key)">
                  {{ getSourceText(currentData, key) }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 items-center justify-between">
          <el-input v-model.trim="configName" placeholder="配置名称" />
          <el-button
            type="primary"
            :icon="DocumentAdd"
            @click="handleSaveConfig"
            :disabled="!configName.trim()"
          >
            保存
          </el-button>
        </div>
      </template>
    </el-card>

    <!-- 已保存的配置 -->
    <el-card class="section-card">
      <template #header>
        <span class="section-title"> <span class="bullet" />已保存的配置 </span>
      </template>
      <div
        v-if="configList.length === 0"
        class="empty-config flex justify-center items-center py-8 rounded border border-dashed border-[var(--el-border-color)] bg-[var(--el-fill-color-extra-light)]"
      >
        <span class="text-[var(--el-font-size-base)] text-[var(--el-text-color-placeholder)]">
          暂无配置，保存后显示（按当前站点区分）
        </span>
      </div>
      <div v-else class="configs-list flex flex-col gap-2">
        <div
          v-for="config in configList"
          :key="config.id"
          class="config-item flex justify-between items-center py-2 rounded bg-[var(--el-fill-color-blank)] border border-[var(--el-border-color-extra-light)] hover:border-[var(--el-border-color-lighter)]"
        >
          <div>
            <div class="font-500 text-[var(--el-text-color-primary)] truncate">
              {{ config.name }}
            </div>
            <div class="text-[var(--el-font-size-base)] text-[var(--el-text-color-placeholder)]">
              {{ getDataKeysCount(config.data) }} 个键 · {{ formatDate(config.createdAt) }}
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <el-button type="primary" @click="handleLoadConfig(config.id)" title="应用">
              应用
            </el-button>
            <el-button
              type="danger"
              :icon="Delete"
              text
              circle
              @click="confirmDelete(config.id, config.name)"
              title="删除"
            />
          </div>
        </div>
      </div>
    </el-card>

    <!-- 查看完整内容 -->
    <el-dialog
      v-model="viewerVisible"
      :title="`查看: ${viewerKey}`"
      width="90%"
      class="value-viewer-dialog"
      destroy-on-close
      @closed="viewerKey = ''"
    >
      <div
        class="value-viewer-content font-mono text-[var(--el-font-size-small)] break-all whitespace-pre-wrap overflow-y-auto"
      >
        {{ viewerContent }}
      </div>
      <template #footer>
        <el-button type="primary" @click="copyValue(viewerContent)"> 复制 </el-button>
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
 * 通过 browser.runtime.sendMessage 与 background 通信
 */
import { Delete, DocumentAdd, Refresh, View } from "@element-plus/icons-vue"
import { useClipboard, useToggle } from "@vueuse/core"
import { ElMessage, ElMessageBox } from "element-plus"
import { omitBy } from "es-toolkit/object"
import { isEmptyObject } from "es-toolkit/predicate"
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import type { StorageConfig, StorageData, StorageType, WatchedKey } from "../types"
import { getDataKeysCount, getSourceText, getSourceType } from "../utils/cacheAssistant"
import { formatDate, formatValue } from "../utils/format"

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

// 连接 background 的 port，用于接收 tab 切换通知
let tabNotifyPort: ReturnType<typeof browser.runtime.connect> | null = null

onMounted(async () => {
  await loadWatchedKeys()
  await loadCurrentData()
  await Promise.all([loadConfigs(), loadCurrentTabUrl()])

  // 连接 background，接收 tab 切换通知后刷新数据
  tabNotifyPort = browser.runtime.connect({ name: "cache-assistant-sidepanel" })
  tabNotifyPort.onMessage.addListener(async (msg: { type?: string }) => {
    if (msg?.type === "TAB_ACTIVATED") {
      await loadCurrentTabUrl()
      await loadWatchedKeys()
      await loadConfigs()
      await loadCurrentData()
    }
  })
})

onBeforeUnmount(() => {
  tabNotifyPort?.disconnect()
})

async function loadCurrentTabUrl() {
  try {
    const res = await browser.runtime.sendMessage({ type: "GET_CURRENT_TAB_URL" })
    if (res?.success) currentHost.value = res.hostname
  } catch {
    /* ignore */
  }
}

async function loadWatchedKeys() {
  try {
    const res = await browser.runtime.sendMessage({ type: "GET_WATCHED_KEYS" })
    if (res?.success) watchedKeys.value = res.keys || []
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
    const res = await browser.runtime.sendMessage({
      type: "GET_STORAGE_DATA",
      items: watchedKeys.value,
    })
    if (res?.success) {
      currentData.value = res.data || {}
    } else {
      ElMessage.error(res?.error || "获取数据失败")
    }
  } catch (e) {
    ElMessage.error("获取数据失败，请确保已打开目标网页")
  }
}

async function loadConfigs() {
  try {
    const res = await browser.runtime.sendMessage({ type: "GET_ALL_CONFIGS" })
    if (res?.success) configs.value = res.configs || {}
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
    const res = await browser.runtime.sendMessage({
      type: "ADD_WATCHED_KEY",
      key,
      storageType: newKeyStorageType.value,
    })
    if (res?.success) {
      await loadWatchedKeys()
      await loadCurrentData()
      newKey.value = ""
      ElMessage.success("添加成功")
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
    const res = await browser.runtime.sendMessage({ type: "REMOVE_WATCHED_KEY", key })
    if (res?.success) {
      await loadWatchedKeys()
      await loadCurrentData()
      ElMessage.success("移除成功")
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
    const res = await browser.runtime.sendMessage({
      type: "SAVE_CONFIG",
      name,
      data: currentData.value,
    })
    if (res?.success) {
      await loadConfigs()
      configName.value = ""
      ElMessage.success("保存成功")
    }
  } catch {
    ElMessage.error("保存失败")
  }
}

async function handleLoadConfig(configId: string) {
  const config = configs.value[configId]
  if (!config) return
  try {
    const res = await browser.runtime.sendMessage({
      type: "SET_STORAGE_DATA",
      data: config.data,
    })
    if (res?.success) {
      await loadCurrentData()
      ElMessage.success("配置已应用，刷新页面后生效")
    }
  } catch {
    ElMessage.error("应用配置失败")
  }
}

async function confirmDelete(configId: string, configName: string) {
  try {
    await ElMessageBox.confirm(`确定要删除配置 "${configName}" 吗？此操作无法撤销。`, "确认删除", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    })
    const res = await browser.runtime.sendMessage({ type: "DELETE_CONFIG", configId })
    if (res?.success) {
      await loadConfigs()
      ElMessage.success("删除成功")
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
.section-card :deep(.el-card__header) {
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-card :deep(.el-card__body) {
  padding: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--el-font-size-base);
  font-weight: 500;
  color: var(--el-text-color-primary);

  .bullet {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--el-color-primary);
  }
}

.section-desc {
  line-height: 1;
}

.value-viewer-dialog :deep(.el-dialog__body) {
  max-height: 70vh;
  overflow: hidden;
}
.value-viewer-content {
  max-height: 65vh;
  padding: 8px 0;
  line-height: 1.4;
}
</style>
