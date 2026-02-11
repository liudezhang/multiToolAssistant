<template>
  <el-config-provider v-bind="configProviderProps">
    <slot />
  </el-config-provider>
</template>

<script setup lang="ts">
/** 全局 Element Plus 配置：统一组件尺寸为 small */
import type { ConfigProviderProps } from "element-plus"

defineOptions({
  name: "RootView",
})

const configProviderProps = reactive<Partial<ConfigProviderProps>>({
  size: "small",
})
</script>
