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
    "neu-raised": "bg-[var(--neu-surface)] shadow-[var(--neu-shadow-md)] rounded-[var(--neu-radius)]",
    "neu-raised-sm":
      "bg-[var(--neu-surface)] shadow-[var(--neu-shadow-sm)] rounded-[var(--neu-radius-sm)]",
    "neu-pressed": "bg-[var(--neu-surface)] shadow-[var(--neu-inset)] rounded-[var(--neu-radius)]",
    "neu-pressed-sm":
      "bg-[var(--neu-surface)] shadow-[var(--neu-inset-sm)] rounded-[var(--neu-radius-sm)]",
    "neu-radius": "rounded-[var(--neu-radius)]",
    "neu-radius-sm": "rounded-[var(--neu-radius-sm)]",
  },
})
