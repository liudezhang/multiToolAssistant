/**
 * 侧边栏路由配置
 * - 工具路由注册
 * - 上次使用工具的记忆（localStorage）
 */
import type { RouteRecordRaw } from "vue-router"
import { createRouter, createWebHashHistory } from "vue-router"
import { browser } from "wxt/browser"
import ToolLayout from "../layouts/ToolLayout.vue"

/** storage 中存储上次使用工具路径的键名 */
const LAST_TOOL_KEY = "lastTool"

/** 工具路由配置 - 新增工具时在此注册 */
export const toolRoutes: RouteRecordRaw[] = [
  {
    path: "/cache-assistant",
    name: "CacheAssistant",
    meta: { title: "缓存助手", desc: "缓存页面的 localStorage / sessionStorage 字段", icon: "Box" },
    component: () => import("../views/tools/CacheAssistant.vue"),
  },
]

/** 首页 + 工具页（带 ToolLayout 布局） */
const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
  },
  {
    path: "/",
    component: ToolLayout,
    children: toolRoutes.map((r) => ({
      ...r,
      path: r.path.slice(1),
    })),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

/** 工具路径列表，用于校验 */
const toolPaths = new Set(toolRoutes.map((r) => r.path))

/** 从 storage 读取上次使用的工具路径 */
async function getLastTool(): Promise<string | null> {
  try {
    const r = await browser.storage.local.get(LAST_TOOL_KEY)
    return (r[LAST_TOOL_KEY] as string) || null
  } catch {
    return null
  }
}

/** 将当前工具路径写入 storage */
function setLastTool(path: string) {
  browser.storage.local.set({ [LAST_TOOL_KEY]: path }).catch(() => {})
}

// 首次进入首页时：若存在上次使用的工具则直接跳转
// 进入工具页时：保存路径供下次恢复
router.beforeEach(async (to, _from, next) => {
  if (to.path === "/" && _from.name === undefined) {
    const last = await getLastTool()
    if (last && toolPaths.has(last)) {
      next(last)
      return
    }
  }
  if (toolPaths.has(to.path)) {
    setLastTool(to.path)
  }
  next()
})

export { router }
