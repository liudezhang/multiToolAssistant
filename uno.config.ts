/** UnoCSS 原子化 CSS 配置 */
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss"

export default defineConfig({
  presets: [
    presetIcons(),
    presetAttributify(),
    presetTypography(),
    presetWind3({}),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  shortcuts: {
    // 面：白底 + 发丝边框，不靠阴影表达层级
    surface: "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)]",
    // 内嵌区块：浅灰底，用于列表 / 预览容器
    well: "bg-[var(--surface-muted)] rounded-[var(--radius-md)]",
    // 浮层：只有弹窗与下拉使用阴影
    popover:
      "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]",
    // 元信息文字：计数、时间、说明
    meta: "text-[var(--el-font-size-extra-small)] text-[var(--el-text-color-secondary)]",
  },
})
