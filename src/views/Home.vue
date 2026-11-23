<template>
  <div class="home flex flex-col h-full">
    <header class="shrink-0 px-4 pt-5 pb-4">
      <h1 class="home-title m-0 text-[18px] font-600">多工具助手</h1>
      <p class="m-0 mt-1 text-[var(--el-font-size-small)] text-[var(--el-text-color-secondary)]">
        选择下方工具开始使用
      </p>
    </header>

    <nav class="flex-1 overflow-y-auto px-3 pb-4" aria-label="工具列表">
      <ul class="tool-list m-0 p-0 list-none">
        <li v-for="route in toolRoutes" :key="route.path">
          <button type="button" class="tool-item" @click="goToTool(route.path)">
            <span class="tool-icon">
              <component :is="getIcon(route.meta?.icon as string)" />
            </span>
            <span class="tool-text">
              <span class="tool-title">{{ route.meta?.title || "工具" }}</span>
              <span class="tool-desc">{{ route.meta?.desc || "" }}</span>
            </span>
            <el-icon class="tool-chevron"><ArrowRight /></el-icon>
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
/** 首页：工具列表，点击进入对应工具 */
import { toolRoutes } from "@/router"
import { ArrowRight, Box, Collection, Key } from "@element-plus/icons-vue"
import type { Component } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()

/** 路由 meta.icon 用到的图标集合（按需引入，避免打包全部图标） */
const iconMap: Record<string, Component> = {
  Box,
  Collection,
  Key,
}

/** 根据路由 meta.icon 名称获取 Element Plus 图标组件 */
function getIcon(name?: string) {
  return (name && iconMap[name]) || Box
}

function goToTool(path: string) {
  router.push(path)
}
</script>

<style lang="scss" scoped>
.home {
  background: var(--surface-muted);

  .home-title {
    letter-spacing: -0.01em;
    color: var(--el-text-color-primary);
  }

  /* 一个容器 + 发丝分隔线，比一排大卡片更接近产品本身 */
  .tool-list {
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);

    li:not(:first-child) {
      border-top: 1px solid var(--border);
    }
  }

  .tool-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    transition: background-color var(--motion-fast) var(--ease);

    &:hover {
      background: var(--surface-hover);
    }

    &:active {
      background: var(--gray-200);
    }
  }

  .tool-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    font-size: 17px;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: var(--radius-md);
  }

  .tool-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .tool-title {
    font-size: var(--el-font-size-base);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .tool-desc {
    overflow: hidden;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-chevron {
    flex-shrink: 0;
    color: var(--el-text-color-placeholder);
    transition:
      transform var(--motion-fast) var(--ease),
      color var(--motion-fast) var(--ease);
  }

  .tool-item:hover .tool-chevron {
    color: var(--el-text-color-secondary);
    transform: translateX(2px);
  }
}
</style>
