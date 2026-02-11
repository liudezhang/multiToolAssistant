<template>
  <div class="tool-layout flex flex-col h-full min-h-0">
    <div
      class="tool-header flex items-center gap-2 shrink-0 py-2 px-3 border-b border-[var(--el-border-color-lighter)]"
    >
      <el-button :icon="ArrowLeft" text circle size="small" @click="goBack" />
      <span class="font-500 text-[var(--el-text-color-primary)] truncate">
        {{ route.meta?.title || "工具" }}
      </span>
    </div>
    <div class="tool-content flex-1 min-h-0 overflow-y-auto">
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

<style scoped>
.tool-content {
  padding: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
