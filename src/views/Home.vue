<template>
  <div class="flex flex-col h-full">
    <div class="pt-5 px-4 pb-4 border-none">
      <h1 class="m-0 text-xl font-600 tracking-wide text-[var(--el-text-color-primary)]">
        多工具助手
      </h1>
      <p class="m-0 mt-2 text-sm text-[var(--el-text-color-secondary)]">
        选择下方工具开始使用
      </p>
    </div>
    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      <div
        v-for="route in toolRoutes"
        :key="route.path"
        class="neu-raised flex items-center gap-3 p-4 cursor-pointer group transition-all duration-200 hover:shadow-[var(--neu-shadow-lg)] hover:-translate-y-0.5 active:shadow-[var(--neu-inset)] active:translate-y-0"
        @click="goToTool(route.path)"
      >
        <div class="neu-pressed-sm w-11 h-11 neu-radius-sm flex items-center justify-center">
          <component
            :is="getIcon(route.meta?.icon as string)"
            class="w-5 h-5 text-[var(--el-color-primary)]"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-600 text-[var(--el-text-color-primary)] text-[15px]">
            {{ route.meta?.title || "工具" }}
          </div>
          <div class="text-xs text-[var(--el-text-color-secondary)] truncate mt-0.5">
            {{ route.meta?.desc || "" }}
          </div>
        </div>
        <el-icon
          class="text-[var(--el-text-color-placeholder)] ml-2 transition-transform duration-200 group-hover:translate-x-1"
          ><ArrowRight /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 首页：工具列表，点击进入对应工具 */
import { toolRoutes } from "@/router"
import * as ElementPlusIcons from "@element-plus/icons-vue"
import { ArrowRight } from "@element-plus/icons-vue"
import type { Component } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()

/** 根据路由 meta.icon 名称获取 Element Plus 图标组件 */
function getIcon(name?: string) {
  if (!name) return ElementPlusIcons.Box
  const icon = (ElementPlusIcons as Record<string, Component>)[name]
  return icon || ElementPlusIcons.Box
}

function goToTool(path: string) {
  router.push(path)
}
</script>
