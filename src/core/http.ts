import { P, runtime } from '@/config'
import type { PageResult } from '@/domains/common/model'
import { pageRecords } from '@/domains/common/model'
import { logout } from '@/domains/identity/session'

export interface ProviderEnvelope<T> {
  success: boolean
  data: T
  errorCode?: { code: string; message: string }
}

let redirectingToLogin = false
let subscriptionPromptVisible = false

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly presented = false
  ) {
    super(message)
    this.name = 'ProviderRequestError'
  }
}

function handleUnauthorized(message?: string) {
  logout()
  if (!redirectingToLogin) {
    redirectingToLogin = true
    uni.reLaunch({
      url: '/pages/auth/login',
      complete: () => setTimeout(() => { redirectingToLogin = false }, 500)
    })
  }
  return new Error(message || '登录状态已失效，请重新登录')
}

function isAuthFailure(code?: string) {
  return code === '401' || code === 'tokenIsUndefined' || code === 'tokenInvalid' || code === 'tokenExpired'
}

function isSubscriptionFailure(code?: string) {
  return code === 'SUBSCRIPTION_EXPIRED' || code === 'UPGRADE_REQUIRED'
}

function presentSubscriptionPrompt(code: string, message: string) {
  if (subscriptionPromptVisible) return
  subscriptionPromptVisible = true
  uni.showModal({
    title: code === 'SUBSCRIPTION_EXPIRED' ? '订阅已到期' : '需要升级套餐',
    content: message,
    confirmText: '查看套餐',
    cancelText: '稍后',
    success: (result) => {
      if (result.confirm) uni.navigateTo({ url: P.subscription })
    },
    complete: () => { subscriptionPromptVisible = false }
  })
}

function providerFailure(message: string, code?: string): ProviderRequestError {
  if (code && isSubscriptionFailure(code)) {
    presentSubscriptionPrompt(code, message)
    return new ProviderRequestError(message, code, true)
  }
  return new ProviderRequestError(message, code)
}

function apiHost(): string {
  return runtime.apiBase.replace(/^https?:\/\//i, '').split('/')[0]
}

/**
 * 历史坑（FIX-025）：微信小程序的 request 和 uploadFile 使用两套独立合法域名。
 * 线上只配置 request 时，普通接口正常，但所有文件上传都会在 uploadFile:fail 直接失败；
 * 不能继续统一显示“网络异常”，否则会把平台配置问题误判成用户网络问题。
 */
function requestFailure(error: unknown, scope: 'request' | 'upload' = 'request'): Error {
  const errMsg = (error as { errMsg?: unknown } | null)?.errMsg
  if (typeof errMsg !== 'string' || !errMsg) return new Error('网络异常，请稍后重试')
  const normalized = errMsg.toLowerCase()
  if (normalized.includes('timeout')) return new Error('请求超时，请稍后重试')
  if (scope === 'upload' && normalized.includes('url not in domain list')) {
    return new Error(`上传域名未配置：请管理员将 ${apiHost()} 加入微信 uploadFile 合法域名`)
  }
  if (scope === 'upload' && (normalized.includes('ssl') || normalized.includes('certificate') || normalized.includes('cert'))) {
    return new Error('上传服务证书异常，请联系管理员检查 HTTPS 证书')
  }
  if (scope === 'upload' && normalized.includes('fail')) {
    return new Error('上传服务连接失败，请检查网络；如持续失败请联系管理员检查上传域名')
  }
  return new Error('网络异常，请检查网络后重试')
}

/** 把后端返回的相对文件地址补成绝对地址（下载/打开文件用）；已是 http(s) 的原样返回。 */
export function absoluteUrl(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return runtime.apiBase.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`)
}

export function post<T>(uri: string, data: any = {}, options: { token?: string } = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${runtime.apiBase}${uri}`,
      method: 'POST',
      data,
      header: {
        'content-type': 'application/json',
        token: options.token || uni.getStorageSync(runtime.tokenKey) || ''
      },
      success: (res) => {
        const body = res.data as ProviderEnvelope<T>
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.success) {
          resolve(body.data)
          return
        }
        if (res.statusCode === 401 || isAuthFailure(body?.errorCode?.code)) {
          reject(handleUnauthorized(body?.errorCode?.message))
          return
        }
        if (res.statusCode >= 500) {
          reject(new Error('服务暂时不可用，请稍后重试'))
          return
        }
        const message = body?.errorCode?.message || `请求失败(${res.statusCode})`
        reject(providerFailure(message, body?.errorCode?.code))
      },
      fail: (error) => reject(requestFailure(error))
    })
  })
}

export function upload<T>(uri: string, filePath: string, formData: Record<string, unknown> = {}, fileField = 'file'): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${runtime.apiBase}${uri}`,
      filePath,
      name: fileField,
      formData,
      header: { token: uni.getStorageSync(runtime.tokenKey) || '' },
      success: (res) => {
        let body: ProviderEnvelope<T>
        try {
          body = JSON.parse(res.data) as ProviderEnvelope<T>
        } catch {
          reject(new Error('上传响应解析失败'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success) resolve(body.data)
        else if (res.statusCode === 401 || isAuthFailure(body.errorCode?.code)) reject(handleUnauthorized(body.errorCode?.message))
        else if (res.statusCode >= 500) reject(new Error('服务暂时不可用，请稍后重试'))
        else {
          const message = body.errorCode?.message || `上传失败(${res.statusCode})`
          reject(providerFailure(message, body.errorCode?.code))
        }
      },
      fail: (error) => reject(requestFailure(error, 'upload'))
    })
  })
}

export function listOf<T>(result: PageResult<T> | T[] | null | undefined): T[] {
  return pageRecords(result)
}

export function firstOf<T>(result: PageResult<T> | T[] | null | undefined): T | undefined {
  return pageRecords(result)[0]
}
