/**
 * WXT 扩展构建配置
 * @see https://wxt.dev/api/config.html
 */
import UnoCSS from "unocss/vite"
import AutoImport from "unplugin-auto-import/vite"
import { ElementPlusResolver } from "unplugin-vue-components/resolvers"
import Components from "unplugin-vue-components/vite"
import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-vue", "@wxt-dev/unocss"],
  manifest: {
    name: "多工具助手",
    description: "浏览器多工具集合，包含缓存助手等实用功能。",
    // storage: 配置持久化 | activeTab/scripting/tabs: content script 通信 | sidePanel: 侧边栏
    permissions: [
      "storage",
      "activeTab",
      "scripting",
      "sessions",
      "background",
      "sidePanel",
      "tabs",
    ],
    // 请求所有 URL 权限，以便 content script 可注入任意页面读取 storage
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "多工具助手",
    },
  },
  vite: () => {
    return {
      plugins: [
        UnoCSS(),
        AutoImport({
          resolvers: [ElementPlusResolver()],
        }),
        Components({
          resolvers: [ElementPlusResolver()],
        }),
      ],
      build: {
        chunkSizeWarningLimit: 1200,
      },
    }
  },
})
