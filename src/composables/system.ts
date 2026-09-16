import { ref } from 'vue'

interface SystemInfo {
  statusBarHeight: number
  navBarHeight: number
  windowWidth: number
  windowHeight: number
  isWeixin: boolean
}

const info = ref<SystemInfo>({
  statusBarHeight: 20,
  navBarHeight: 44,
  windowWidth: 375,
  windowHeight: 667,
  isWeixin: false
})

let loaded = false
export function useSystem() {
  if (!loaded) {
    try {
      const s = uni.getSystemInfoSync()
      const weixin = s.platform === 'devtools' || s.uniPlatform === 'mp-weixin'
      info.value = {
        statusBarHeight: s.statusBarHeight || 20,
        navBarHeight: 44,
        windowWidth: s.windowWidth || 375,
        windowHeight: s.windowHeight || 667,
        isWeixin: weixin
      }
      loaded = true
    } catch (e) {
      loaded = true
    }
  }
  return { system: info }
}
