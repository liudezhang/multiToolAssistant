<template>
  <RootView>
    <div class="app w-full h-full flex flex-col bg-[var(--el-fill-color-blank)]">
      <router-view />
    </div>
  </RootView>
</template>

<script setup lang="ts">
/** 侧边栏根组件：提供 Element Plus 配置与路由视图 */
import RootView from "../../components/RootView.vue"
</script>
