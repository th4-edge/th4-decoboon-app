export interface ChosenMedia {
  url: string
  type: 'image' | 'video'
}

export interface ChooseMediaOptions {
  count: number
  mediaType?: Array<'image' | 'video'>
  sourceType?: Array<'album' | 'camera'>
  sizeType?: Array<'original' | 'compressed'>
}

function errorMessage(error: unknown): string {
  const message = String((error as { errMsg?: unknown } | null)?.errMsg || '')
  const normalized = message.toLowerCase()
  if (normalized.includes('cancel')) return ''
  if (normalized.includes('auth') || normalized.includes('authorize') || normalized.includes('permission')) {
    return '未获得相机或相册权限，请在微信设置中开启后重试'
  }
  if (normalized.includes('not support') || normalized.includes('unsupported')) {
    return '当前微信版本不支持照片选择，请升级微信后重试'
  }
  if (normalized.includes('devtools') || normalized.includes('simulator')) {
    return '当前开发者工具环境无法打开照片选择器，请使用真机验证'
  }
  return '照片选择失败，请重试'
}

/**
 * 统一图片/视频选择入口。
 * 历史坑：FIX-035 多页直接调用 uni.chooseImage 且无 fail 回调，失败时表现为“点击没反应”。
 * 小程序优先 chooseMedia，旧环境回退 chooseImage；取消返回空数组，其他失败抛出可展示错误。
 */
export function chooseMedia(options: ChooseMediaOptions): Promise<ChosenMedia[]> {
  const count = Math.max(1, Math.min(9, Number(options.count) || 1))
  const mediaType = options.mediaType || ['image']
  const sourceType = options.sourceType || ['album', 'camera']
  const sizeType = options.sizeType || ['compressed']

  return new Promise((resolve, reject) => {
    const fail = (error: unknown) => {
      const message = errorMessage(error)
      if (!message) resolve([])
      else reject(new Error(message))
    }
    const chooseMediaApi = (uni as unknown as { chooseMedia?: (options: Record<string, unknown>) => void }).chooseMedia
    if (typeof chooseMediaApi === 'function') {
      chooseMediaApi({
        count,
        mediaType,
        sourceType,
        sizeType,
        success: (result: { tempFiles?: Array<{ tempFilePath?: string; fileType?: string }> }) => {
          resolve((result.tempFiles || [])
            .filter((file) => Boolean(file.tempFilePath))
            .map((file) => ({
              url: String(file.tempFilePath),
              type: file.fileType === 'video' ? 'video' as const : 'image' as const
            })))
        },
        fail
      })
      return
    }

    if (typeof uni.chooseImage === 'function') {
      uni.chooseImage({
        count,
        sizeType,
        sourceType,
        success: (result: any) => {
          const paths = Array.isArray(result.tempFilePaths)
            ? result.tempFilePaths
            : result.tempFilePaths ? [result.tempFilePaths] : []
          resolve(paths.map((url: string) => ({ url, type: 'image' as const })))
        },
        fail
      })
      return
    }

    reject(new Error('当前环境不支持照片选择，请升级微信后重试'))
  })
}

export async function chooseImages(options: Omit<ChooseMediaOptions, 'mediaType'>): Promise<string[]> {
  const medias = await chooseMedia({ ...options, mediaType: ['image'] })
  return medias.filter((item) => item.type === 'image').map((item) => item.url)
}
