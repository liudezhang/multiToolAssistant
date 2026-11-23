/** 侧边栏入口 - 挂载 Vue 应用 */
import "virtual:uno.css"
import { createApp } from "vue"
import { router } from "@/router"
import App from "@/entrypoints/sidepanel/App.vue"
// 全局样式放在组件之后导入，确保设计 token 覆盖 Element Plus 的默认变量
import "@/styles/global.scss"

const app = createApp(App)
app.use(router)
app.mount("#app")
