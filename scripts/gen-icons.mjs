#!/usr/bin/env node
/**
 * 从 SVG 生成多尺寸 PNG 图标（透明背景）
 * 可通过 genIcons(config) 调用，或直接运行使用默认配置
 */
import sharp from "sharp"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 生成多尺寸 PNG 图标
 * @param {Object} config - 必要配置
 * @param {string} config.svgPath - SVG 源文件路径
 * @param {string} config.outDir - 输出目录
 * @param {number[]} config.sizes - 目标尺寸列表，如 [16, 32, 48, 96, 128]
 * @param {Object} [config.options] - 可选覆盖
 * @param {number} [config.options.scale] - 光栅化倍率，用于提升 SVG 渲染清晰度，默认 16
 * @param {number} [config.options.maxSizeKB] - 单文件大小警告阈值(KB)，默认 64
 * @param {number} [config.options.compressionLevel] - PNG 压缩级别 0-9，默认 9
 */
async function genIcons(config) {
  const { svgPath, outDir, sizes } = config
  const { scale = 16, maxSizeKB = 64, compressionLevel = 9 } = config.options ?? {}

  // 光栅化基准尺寸只影响渲染清晰度，最终输出必须是精确的目标尺寸
  const rasterSize = Math.max(1024, Math.max(...sizes) * scale)
  // 自动计算：SVG 光栅化密度，避免低分辨率放大模糊
  const density = Math.max(72, Math.round((rasterSize / 1024) * 144))

  const svg = readFileSync(svgPath)

  for (const size of sizes) {
    const outPath = resolve(outDir, `${size}.png`)
    const png = await sharp(svg, { density })
      .resize(size, size, { fit: "contain" })
      .png({ compressionLevel })
      .toFile(outPath)

    const sizeKB = (png.size / 1024).toFixed(1)
    if (png.size > maxSizeKB * 1024) {
      console.warn(`Warning: ${size}.png (${sizeKB} KB) exceeds ${maxSizeKB} KB`)
    }
    console.log(`${size}.png: ${sizeKB} KB`)
  }

  console.log("Done. Icons generated with transparent background.")
}

// 导出供其他脚本调用
export { genIcons }

// CLI 入口：直接运行时使用默认配置
const defaultConfig = {
  svgPath: resolve(__dirname, "../public/icon/icon.svg"),
  outDir: resolve(__dirname, "../public/icon"),
  sizes: [16, 32, 48, 96, 128],
  options: {
    scale: 16,
    compressionLevel: 9,
  },
}

genIcons(defaultConfig).catch(console.error)
