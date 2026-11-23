<template>
  <div class="tool-layout flex flex-col h-full min-h-0">
    <header class="tool-header shrink-0 flex items-center gap-1.5 h-12 px-2.5">
      <el-button
        :icon="ArrowLeft"
        text
        circle
        aria-label="返回工具列表"
        @click="goBack"
      />
      <h1 class="m-0 text-[15px] font-600 truncate text-[var(--el-text-color-primary)]">
        {{ route.meta?.title || "工具" }}
      </h1>
    </header>
    <div class="flex-1 min-h-0 overflow-y-auto">
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
.tool-layout {
  background: var(--surface);

  .tool-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
