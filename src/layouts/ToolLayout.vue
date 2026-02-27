<template>
  <div class="tool-layout flex flex-col h-full min-h-0">
    <div class="tool-header neu-pressed-sm flex items-center gap-2 shrink-0 py-3 px-4 mx-3 mt-3 neu-radius-sm">
      <el-button :icon="ArrowLeft" text circle size="small" class="tool-back-btn" @click="goBack" />
      <span class="font-600 text-[var(--el-text-color-primary)] truncate text-[15px]">
        {{ route.meta?.title || "工具" }}
      </span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto py-3 px-4 pb-4">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 工具页布局：顶部返回栏 + 工具内容区域 */
import { ArrowLeft } from "@element-plus/icons-vue"
import { useRoute, useRouter } from "vue-router"

const route = useRoute()
const router = useRouter()

function goBack() {
  router.push("/")
}
</script>

<style lang="scss" scoped>
/* 工具布局 - 按 DOM 父子层级 */
.tool-layout {
  .tool-header .tool-back-btn {
    color: var(--el-text-color-secondary) !important;

    &:hover {
      color: var(--el-color-primary) !important;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
