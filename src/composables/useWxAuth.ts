import { toast } from './toast'

export interface WxPhoneAuthResult {
  phoneCode: string
  cancelled: boolean
}

/**
 * 微信小程序手机号授权回调处理。
 * 统一处理用户拒绝、基础库版本过低、系统错误等场景，
 * 避免各页面重复写 if (!code) toast 的粗糙判断。
 */
export function useWxPhoneAuth() {
  function handlePhoneNumber(
    event: { detail?: { code?: string; errMsg?: string; encryptedData?: string; iv?: string } },
  ): WxPhoneAuthResult | null {
    const detail = event.detail
    const errMsg = detail?.errMsg || ''
    const phoneCode = detail?.code

    // 开发环境调试：打印完整回调，方便排查开发者工具问题
    if (import.meta.env.DEV) {
      console.log('[useWxAuth] getPhoneNumber callback:', JSON.stringify(detail))
    }

    // 用户主动拒绝授权：微信允许拒绝后再次点击按钮重新弹窗
    if (errMsg.includes('deny')) {
      toast('已取消手机号快捷登录，可重新尝试')
      return { phoneCode: '', cancelled: true }
    }

    // 其他失败（网络、系统内部错误等）
    if (errMsg.includes('fail') && !phoneCode) {
      toast('手机号快捷登录失败，请重试')
      return { phoneCode: '', cancelled: true }
    }

    // code 为空且无明确 errMsg：大概率是基础库版本过低
    // getPhoneNumber 返回 code 字段要求基础库 >= 2.21.2（微信 8.0.28+）
    if (!phoneCode) {
      const sysInfo = uni.getSystemInfoSync()
      const sdkVersion = sysInfo.SDKVersion || ''
      const isDevTool = sysInfo.platform === 'devtools'
      if (sdkVersion && compareVersion(sdkVersion, '2.21.2') < 0) {
        toast(isDevTool
          ? '开发者工具基础库过低，请在右上角详情→本地设置→调试基础库切换到 2.21.2 以上'
          : '当前客户端版本过低，请升级后重试')
      } else if (detail?.encryptedData && !detail?.code) {
        // 旧版基础库返回 encryptedData/iv 而非 code，当前后端只支持 code 模式
        toast(isDevTool
          ? '当前基础库使用旧版加密模式，请切换调试基础库到最新版'
          : '当前客户端版本过低，请升级后重试')
      } else {
        toast('请使用手机号快捷登录后继续')
      }
      return { phoneCode: '', cancelled: true }
    }

    return { phoneCode, cancelled: false }
  }

  return { handlePhoneNumber }
}

/** 比较语义化版本号，返回 -1 / 0 / 1 */
function compareVersion(v1: string, v2: string): number {
  const parts1 = v1.split('.').map((n) => parseInt(n, 10) || 0)
  const parts2 = v2.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < len; i++) {
    const a = parts1[i] || 0
    const b = parts2[i] || 0
    if (a > b) return 1
    if (a < b) return -1
  }
  return 0
}
