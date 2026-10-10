import { fileApi } from '@/domains/file/api'
import type { CustomerFollow } from '@/domains/crm/model'
import { toastError } from '@/composables/toast'

/** 解析并缓存跟进图片的短期访问地址。 */
export async function followImageUrls(follow: CustomerFollow, force = false): Promise<string[]> {
  const existing = force ? [] : (follow.imageUrls || []).filter(Boolean)
  if (existing.length) return existing
  if (!follow.id || !follow.images?.length) return []
  try {
    const urls = await fileApi.grant('CustomerFollow', follow.id, follow.images)
    follow.imageUrls = urls
    return urls
  } catch (error) {
    toastError(error, '图片加载失败')
    return []
  }
}

/** 统一打开跟进图片预览，URL 过期时先重新授权。 */
export async function previewFollowImage(follow: CustomerFollow, index = 0, force = false): Promise<void> {
  const urls = await followImageUrls(follow, force)
  if (!urls.length) {
    uni.showToast({ title: '图片暂不可加载', icon: 'none' })
    return
  }
  const current = urls[Math.min(Math.max(index, 0), urls.length - 1)]
  uni.previewImage({
    urls,
    current,
    fail: () => { if (!force) void previewFollowImage(follow, index, true) }
  })
}
