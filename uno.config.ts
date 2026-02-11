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
  transformers: [transformerVariantGroup(), transformerDirectives()],
})
