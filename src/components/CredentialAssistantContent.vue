<template>
  <div class="cred-content flex flex-col h-full">
    <!-- 当前站点 + 搜索 -->
    <div class="site shrink-0 px-4 py-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-baseline gap-2 min-w-0">
          <span class="meta shrink-0">当前站点</span>
          <span class="site-host tabular">{{ hostname || "—" }}</span>
        </div>
        <el-button text size="small" :icon="Plus" :disabled="!hostname" @click="openCreate">
          新增
        </el-button>
      </div>
      <p class="m-0 mt-1 meta">
        {{ domain ? `同一主域 ${domain} 的账号聚合展示` : "打开目标网页后可保存账号" }}，密码明文存于扩展存储
      </p>
      <el-input
        v-model.trim="keyword"
        class="mt-2"
        placeholder="搜索全部站点的账号 / 备注"
        :prefix-icon="Search"
        clearable
      />
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto px-4">
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">{{ isSearching ? "搜索结果" : "本站点账号" }}</h2>
          <div class="flex items-center gap-2">
            <span class="meta tabular">{{ rows.length }} 个</span>
            <el-button text size="small" :icon="Upload" @click="fileInput?.click()">导入</el-button>
            <span class="capture-toggle">
              <el-switch v-model="autoCapture" size="small" @change="toggleAutoCapture" />
              <span class="meta">自动捕获</span>
            </span>
          </div>
        </div>

        <p v-if="!rows.length" class="empty">
          {{ isSearching ? "没有匹配的账号" : "还没有保存账号，点右上角「新增」" }}
        </p>

        <ul v-else class="rows m-0 p-0 list-none">
          <li v-for="item in rows" :key="item.id" class="row">
            <button type="button" class="row-main" @click="openEdit(item)">
              <span class="username" :title="item.username">{{ item.username }}</span>
              <span v-if="isSearching || item.hostname !== hostname" class="host-tag tabular">
                {{ item.hostname }}
              </span>
            </button>
            <div class="row-foot">
              <span class="pwd tabular">
                {{ isRevealed(item.id) ? item.password || "（未填写）" : maskPassword(item.password) }}
              </span>
              <span v-if="item.note" class="note" :title="item.note">{{ item.note }}</span>
              <div class="row-actions">
                <el-button
                  :icon="isRevealed(item.id) ? Hide : View"
                  text
                  circle
                  size="small"
                  :aria-label="isRevealed(item.id) ? '隐藏密码' : '显示密码'"
                  @click="toggleReveal(item.id)"
                />
                <el-button
                  :icon="User"
                  text
                  circle
                  size="small"
                  aria-label="复制账号"
                  @click="copyText(item.username, '账号')"
                />
                <el-button
                  :icon="CopyDocument"
                  text
                  circle
                  size="small"
                  aria-label="复制密码"
                  :disabled="!item.password"
                  @click="copyText(item.password, '密码')"
                />
                <el-button
                  :icon="Aim"
                  text
                  circle
                  size="small"
                  aria-label="填充到当前页面"
                  @click="fill(item)"
                />
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- 新增 / 编辑 -->
    <input
      ref="fileInput"
      type="file"
      accept=".csv,text/csv"
      class="hidden"
      @change="onFileChange"
    />
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑账号' : '新增账号'"
      width="92%"
      destroy-on-close
      @closed="editing = null"
    >
      <el-form label-width="64px">
        <el-form-item label="账号" required>
          <el-input v-model.trim="form.username" placeholder="登录账号 / 邮箱" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="留空表示不通过密码登录"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model.trim="form.note" placeholder="如：生产环境管理员" />
        </el-form-item>
        <el-form-item label="登录地址">
          <el-input v-model.trim="form.loginUrl" placeholder="可选，如 https://admin.example.com" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="editing" type="danger" text class="mr-auto" @click="remove(editing)">
          删除
        </el-button>
        <el-button v-if="editingLoginUrl" text @click="openLoginUrl(editingLoginUrl)">
          打开登录页
        </el-button>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 账号助手核心组件：
 * - 按「主域」聚合当前项目的账号，行内标注来源子域
 * - 支持复制账号/密码、手动填充到当前登录页
 * - 支持跨站点搜索
 * 通过 utils/messaging 的 sendMessage 与 background 通信
 */
import type { Credential } from "@/types"
import { parseCredentialCsv } from "@/utils/csv"
import { getPrimaryDomain, maskPassword } from "@/utils/credential"
import { sendMessage } from "@/utils/messaging"
import {
  Aim,
  CopyDocument,
  Hide,
  Plus,
  Search,
  Upload,
  User,
  View,
} from "@element-plus/icons-vue"
import { useClipboard, useDebounceFn } from "@vueuse/core"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { browser } from "wxt/browser"

const hostname = ref("")
const keyword = ref("")
const credentials = ref<Credential[]>([])
const searchResults = ref<Credential[]>([])
const revealedIds = ref<string[]>([])
const dialogVisible = ref(false)
const editing = ref<Credential | null>(null)
const form = ref({ username: "", password: "", note: "", loginUrl: "" })
const autoCapture = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)

/** 聚合用的主域，仅用于展示提示 */
const domain = computed(() => getPrimaryDomain(hostname.value))
const isSearching = computed(() => keyword.value.trim().length > 0)
const editingLoginUrl = computed(() => editing.value?.loginUrl ?? "")

/** 列表按最近更新排序；搜索时展示全站结果 */
const rows = computed(() => {
  const list = isSearching.value ? searchResults.value : credentials.value
  return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

let refreshPort: ReturnType<typeof browser.runtime.connect> | null = null

onMounted(async () => {
  await refresh()

  // 与缓存助手共用同一个 port，标签页切换时重新加载站点与账号
  refreshPort = browser.runtime.connect({ name: "sidepanel" })
  refreshPort.onMessage.addListener(
    async (msg: { type?: string; username?: string }) => {
      if (msg?.type === "PAGE_REFRESHED") {
        await refresh()
      } else if (msg?.type === "CREDENTIAL_CAPTURED") {
        await reloadAfterChange()
        ElMessage.success(`已自动保存账号 ${msg.username ?? ""}`.trim())
      } else if (msg?.type === "CREDENTIAL_IMPORTED") {
        await reloadAfterChange()
      }
    }
  )
})

onBeforeUnmount(() => refreshPort?.disconnect())

async function refresh() {
  await loadSite()
  await loadCredentials()
  if (isSearching.value) await runSearch()
}

async function loadSite() {
  try {
    const res = await sendMessage("GET_CURRENT_TAB_URL")
    if (res.success) hostname.value = res.hostname
  } catch {
    /* 无可用标签页时忽略 */
  }
}

async function loadCredentials() {
  if (!hostname.value) {
    credentials.value = []
    return
  }
  try {
    const res = await sendMessage("GET_CREDENTIALS")
    if (res.success) {
      credentials.value = res.credentials ?? []
      if (typeof res.autoCapture === "boolean") autoCapture.value = res.autoCapture
    } else {
      ElMessage.error(res.error || "加载账号失败")
    }
  } catch {
    ElMessage.error("加载账号失败")
  }
}

async function runSearch() {
  const query = keyword.value.trim()
  try {
    const res = await sendMessage("SEARCH_CREDENTIALS", { keyword: query })
    // 输入变化快时，旧请求可能后到，丢弃已经过期的结果
    if (keyword.value.trim() !== query) return
    if (res.success) searchResults.value = res.credentials ?? []
    else ElMessage.error(res.error || "搜索失败")
  } catch {
    ElMessage.error("搜索失败")
  }
}

const debouncedSearch = useDebounceFn(runSearch, 250)

watch(keyword, (value) => {
  if (value.trim()) void debouncedSearch()
  else searchResults.value = []
})

/** 增删改之后同步刷新当前站点列表与搜索结果 */
async function reloadAfterChange() {
  await loadCredentials()
  if (isSearching.value) await runSearch()
}

function openCreate() {
  editing.value = null
  form.value = { username: "", password: "", note: "", loginUrl: "" }
  dialogVisible.value = true
}

function openEdit(item: Credential) {
  editing.value = item
  form.value = {
    username: item.username,
    password: item.password,
    note: item.note ?? "",
    loginUrl: item.loginUrl ?? "",
  }
  dialogVisible.value = true
}

async function submit() {
  const username = form.value.username.trim()
  if (!username) {
    ElMessage.warning("请输入账号")
    return
  }
  const isEdit = Boolean(editing.value)
  try {
    const res = await sendMessage("SAVE_CREDENTIAL", {
      ...(editing.value ? { id: editing.value.id } : {}),
      username,
      password: form.value.password,
      note: form.value.note.trim() || undefined,
      loginUrl: form.value.loginUrl.trim() || undefined,
    })
    if (res.success) {
      dialogVisible.value = false
      await reloadAfterChange()
      // 弹窗关闭动画结束后 editing 会被清空，故用提前记下的 isEdit
      ElMessage.success(isEdit ? "已更新" : "已保存")
    } else {
      ElMessage.error(res.error || "保存失败")
    }
  } catch {
    ElMessage.error("保存失败")
  }
}

async function remove(item: Credential) {
  try {
    await ElMessageBox.confirm(`确定要删除账号「${item.username}」吗？`, "确认删除", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    })
    const res = await sendMessage("DELETE_CREDENTIAL", { id: item.id })
    if (res.success) {
      dialogVisible.value = false
      await reloadAfterChange()
      ElMessage.success("已删除")
    } else {
      ElMessage.error(res.error || "删除失败")
    }
  } catch (e) {
    if (e !== "cancel") ElMessage.error("删除失败")
  }
}

/** 自动捕获开关：关闭后 content script 上报的登录凭据不会被落库 */
async function toggleAutoCapture(value: string | number | boolean) {
  const enabled = Boolean(value)
  try {
    const res = await sendMessage("SET_AUTO_CAPTURE", { enabled })
    if (res.success) {
      ElMessage.success(enabled ? "已开启自动捕获" : "已关闭自动捕获")
    } else {
      autoCapture.value = !enabled
      ElMessage.error(res.error || "保存开关失败")
    }
  } catch {
    autoCapture.value = !enabled
    ElMessage.error("保存开关失败")
  }
}

/** 导入浏览器 / 密码管理器导出的 CSV，已存在的账号自动跳过 */
async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 清空 value，允许重复选择同一个文件
  input.value = ""
  if (!file) return

  try {
    const items = parseCredentialCsv(await file.text())
    if (!items.length) {
      ElMessage.warning("未解析到账号，请确认 CSV 带 url / username / password 表头")
      return
    }
    const res = await sendMessage("IMPORT_CREDENTIALS", { items })
    if (res.success) {
      await reloadAfterChange()
      ElMessage.success(`导入 ${res.imported ?? 0} 条，跳过 ${res.skipped ?? 0} 条`)
    } else {
      ElMessage.error(res.error || "导入失败")
    }
  } catch {
    ElMessage.error("读取 CSV 失败")
  }
}

/** 填充由用户手动触发，content script 只填当前页面已存在的登录表单 */
async function fill(item: Credential) {
  try {
    const res = await sendMessage("FILL_LOGIN_FORM", {
      username: item.username,
      password: item.password,
    })
    if (res.success) ElMessage.success("已填入当前页面的登录表单")
    else ElMessage.error(res.error || "填充失败，请确认已打开登录页")
  } catch {
    ElMessage.error("填充失败，请确保已打开目标网页")
  }
}

function toggleReveal(id: string) {
  revealedIds.value = revealedIds.value.includes(id)
    ? revealedIds.value.filter((item) => item !== id)
    : [...revealedIds.value, id]
}

/** 在新标签页打开该账号保存的登录地址 */
function openLoginUrl(url: string) {
  browser.tabs.create({ url }).catch(() => ElMessage.error("打开登录页失败"))
}

function isRevealed(id: string) {
  return revealedIds.value.includes(id)
}

const { copy } = useClipboard()

async function copyText(text: string, label: string) {
  if (!text) {
    ElMessage.warning(`${label}为空`)
    return
  }
  try {
    await copy(text)
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.error("复制失败")
  }
}
</script>

<style lang="scss" scoped>
.cred-content {
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

  .section {
    padding-block: 16px;
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

  .capture-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .empty {
    margin: 0;
    padding: 14px 0;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .row {
    padding: 8px 0;

    & + .row {
      border-top: 1px solid var(--border);
    }
  }

  .row-main {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding: 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover .username {
      color: var(--accent);
    }
  }

  .username {
    min-width: 0;
    overflow: hidden;
    font-size: var(--el-font-size-base);
    font-weight: 500;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color var(--motion-fast) var(--ease);
  }

  .host-tag {
    flex-shrink: 0;
    max-width: 55%;
    overflow: hidden;
    padding: 0 6px;
    font-size: var(--el-font-size-extra-small);
    line-height: 18px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
  }

  .row-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;

    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }

  .pwd {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-regular);
    letter-spacing: 0.5px;
  }

  .note {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-actions {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    margin-left: auto;
  }
}
</style>
