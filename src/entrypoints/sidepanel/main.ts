/** 侧边栏入口 - 挂载 Vue 应用 */
import ElementPlus from "element-plus"
import "element-plus/dist/index.css"
import "virtual:uno.css"
import { createApp } from "vue"
import { router } from "../../router"
import "../../styles/global.scss"
import App from "./App.vue"

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount("#app")
