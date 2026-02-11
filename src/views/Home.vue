<template>
  <div class="home-view flex flex-col h-full">
    <div class="home-header pt-4 px-3 border-b border-[var(--el-border-color-lighter)]">
      <h1 class="text-lg font-600 text-[var(--el-text-color-primary)] m-0">多工具助手</h1>
      <p class="text-sm text-[var(--el-text-color-secondary)] mt-1 m-0">选择下方工具开始使用</p>
    </div>
    <div class="home-tools flex-1 overflow-y-auto p-3">
      <div
        v-for="route in toolRoutes"
        :key="route.path"
        class="tool-card flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--el-fill-color-light)] border border-dashed border-[var(--el-border-color-lighter)]"
        @click="goToTool(route.path)"
      >
        <div
          class="tool-icon w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--el-color-primary-light-9)]"
        >
          <component
            :is="getIcon(route.meta?.icon as string)"
            class="w-5 h-5 text-[var(--el-color-primary)]"
          />
        </div>
        <div class="tool-info flex-1 min-w-0">
          <div class="font-500 text-[var(--el-text-color-primary)]">
            {{ route.meta?.title || "工具" }}
          </div>
          <div class="text-xs text-[var(--el-text-color-secondary)] truncate">
            {{ route.meta?.desc || "" }}
          </div>
        </div>
        <el-icon class="text-[var(--el-text-color-placeholder)] ml-2"><ArrowRight /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 首页：工具列表，点击进入对应工具 */
import * as ElementPlusIcons from "@element-plus/icons-vue"
import { ArrowRight } from "@element-plus/icons-vue"
import type { Component } from "vue"
import { useRouter } from "vue-router"
import { toolRoutes } from "../router"

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
