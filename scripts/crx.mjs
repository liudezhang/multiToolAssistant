#!/usr/bin/env node
/**
 * 打包为 CRX 插件
 * 输出: dist/multi-tool-assistant.crx, dist/multi-tool-assistant.zip
 */
import { execSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const INPUT = resolve(root, ".output/chrome-mv3")
const CRX_OUT = resolve(root, "dist/multi-tool-assistant.crx")
const ZIP_OUT = resolve(root, "dist/multi-tool-assistant.zip")
const KEY_PATH = resolve(root, ".crx-key.pem")

// 1. 构建
console.log("Building extension...")
execSync("wxt build", { cwd: root, stdio: "inherit" })

// 2. 确保 dist 目录存在
mkdirSync(resolve(root, "dist"), { recursive: true })

// 3. 打包 CRX
console.log("Packaging CRX...")
execSync(
  `crx3 "${INPUT}" -o "${CRX_OUT}" -p "${KEY_PATH}" -z "${ZIP_OUT}"`,
  { cwd: root, stdio: "inherit" }
)

console.log("Done. Output: dist/multi-tool-assistant.crx, dist/multi-tool-assistant.zip")
