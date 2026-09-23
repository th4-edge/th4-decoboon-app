import { post, upload as uploadRequest } from '@/core/http'
import { runtime } from '@/config'

export type PrivateFileScope =
  | 'Report'
  | 'Acceptance'
  | 'Feedback'
  | 'ContractChange'
  | 'Design'
  | 'Talk'
  | 'Measure'
  | 'Task'
  | 'GoodsReceipt'
  | 'StockMovement'
  | 'Catalog'

interface RawFileGrant {
  path?: string
  url?: string
  expiresAt?: string
  name?: string
  contentType?: string
  size?: number
}

export interface UploadedFile {
  path: string
  url: string
  name?: string
  contentType?: string
  size?: number
}

function isManagedPath(path: string): boolean {
  if (!path) return false
  // 私有下载链接：/file/private/download?path=xxx，由 storagePath 还原
  if (path.includes('/file/private/download')) return true
  // 完整 URL：先提取路径部分，再按前缀判断
  let value = path
  if (/^https?:\/\//i.test(path)) {
    value = path.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
  }
  value = value.replace(/^\/+/, '')
  return value.startsWith('upload/') || value.startsWith('companies/') || value.startsWith('system/')
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/file/private/download')) {
    return runtime.apiBase.replace(/\/$/, '') + path
  }
  return path
}

function storageKey(path: string): string {
  return path.replace(/^\/+/, '').replace(/^upload\//, '')
}

export const fileApi = {
  isManaged: (path?: string): boolean => Boolean(path && isManagedPath(path)),

  /** 上传文件到企业/项目 OSS 路径，返回业务字段应保存的稳定对象键。 */
  upload: async (
    businessType: PrivateFileScope,
    filePath: string,
    options: { projectId?: string } = {}
  ): Promise<UploadedFile> => {
    // 历史坑：projectId 为 undefined 时直接放入 formData，uni.uploadFile 会序列化为字符串 "undefined"，
    // 后端 @AutoInject Long projectId 转换失败导致上传接口报错。量房等无项目场景必须省略该字段。
    const formData: Record<string, unknown> = { businessType }
    if (options.projectId) formData.projectId = options.projectId
    const grants = await uploadRequest<RawFileGrant[]>('file/private/grant', filePath, formData)
    const grant = grants?.[0]
    if (!grant.path) throw new Error('文件上传未返回存储路径')
    return {
      path: grant.path,
      url: grant.url ? absoluteUrl(grant.url) : absoluteUrl(`/file/private/download?path=${encodeURIComponent(grant.path)}`),
      name: grant.name,
      contentType: grant.contentType,
      size: grant.size
    }
  },

  /** 只为当前业务对象实际引用且当前身份可访问的本地文件签发短期 URL。 */
  grant: async (businessType: PrivateFileScope, businessId: string, paths: string[]): Promise<string[]> => {
    const managedPaths = [...new Set(paths.filter((path) => typeof path === 'string' && isManagedPath(path)))]
    if (!managedPaths.length) return paths
    const grants = await post<RawFileGrant[]>('file/private/grant', {
      businessType,
      businessId,
      paths: managedPaths
    })
    const byPath = new Map(grants.map((grant) => [grant.path || '', grant.url ? absoluteUrl(grant.url) : '']))
    return paths.map((path) => {
      if (!isManagedPath(path)) return path
      return byPath.get(storageKey(path)) || path
    })
  },

  /** 签名 URL 回写业务字段前恢复为 upload-dir 相对路径。 */
  storagePath: (value?: string): string | undefined => {
    if (!value) return undefined
    if (value.includes('/file/private/download')) {
      const query = value.split('?')[1]
      if (!query) return value
      const pair = query.split('&').find((item) => item.startsWith('path='))
      return pair ? decodeURIComponent(pair.slice('path='.length)) : value
    }
    if (/^https?:\/\//i.test(value)) {
      const path = value.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
      const companyIndex = path.indexOf('/companies/')
      const systemIndex = path.indexOf('/system/')
      const index = companyIndex >= 0 ? companyIndex : systemIndex
      if (index < 0) return value
      return decodeURIComponent(path.slice(index + 1))
    }
    return storageKey(value)
  }
}
