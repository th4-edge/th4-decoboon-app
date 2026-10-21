import { computed, reactive } from 'vue'
import { P } from '@/config'
import { journeyApi } from '@/domains/journey/api'
import type { CustomerJourney } from '@/domains/journey/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'

interface OwnerPreviewState {
  active: boolean
  projectId: string
  journey: CustomerJourney | null
}

/**
 * 员工侧业主视角预览的跨页上下文。
 *
 * 预览始终复用业主端真实页面，不创建业主 token / CustomerAccess；
 * 四个 Tab 通过查询参数恢复同一项目上下文，避免页面切换后串成员工视图。
 */
export const ownerPreview = reactive<OwnerPreviewState>({
  active: false,
  projectId: '',
  journey: null
})

export const ownerPreviewActive = computed(() => ownerPreview.active)

export const ownerPreviewWatermark = computed(() => {
  return ownerPreview.journey?.previewMeta?.watermark || '业主视角预览 · 仅内部使用'
})

/** 仅在拥有预览能力的员工访问带 preview=1 的业主页面时激活上下文。 */
export function activateOwnerPreviewFromQuery(query?: Record<string, string | undefined>): boolean {
  if (query?.preview !== '1' || !query.projectId) return false
  if (!isLoggedIn() || !can(session.role, 'view:owner-preview')) return false
  if (ownerPreview.projectId !== query.projectId) ownerPreview.journey = null
  ownerPreview.active = true
  ownerPreview.projectId = query.projectId
  return true
}

export function setOwnerPreviewJourney(journey: CustomerJourney | null): void {
  if (!ownerPreview.active) return
  ownerPreview.journey = journey
}

/** 页面被直接刷新或从分享路径进入时，补取同一份员工侧预览投影。 */
export async function ensureOwnerPreviewJourney(): Promise<CustomerJourney | null> {
  if (!ownerPreview.active || !ownerPreview.projectId) return null
  if (ownerPreview.journey?.projectId === ownerPreview.projectId) return ownerPreview.journey
  try {
    const journey = await journeyApi.ownerPreviewInfo(ownerPreview.projectId)
    setOwnerPreviewJourney(journey)
    return journey
  } catch {
    return null
  }
}

/** 四个业主 Tab 的预览路由必须携带同一项目和只读标记。 */
export function ownerPreviewTabUrl(path: string, projectId = ownerPreview.projectId): string {
  const query = `preview=1&projectId=${encodeURIComponent(projectId)}`
  return `${path}${path.includes('?') ? '&' : '?'}${query}`
}

export function navigateOwnerPreviewTab(path: string): void {
  if (!ownerPreview.active || !ownerPreview.projectId) return
  uni.redirectTo({ url: ownerPreviewTabUrl(path) })
}

export function resetOwnerPreview(): void {
  ownerPreview.active = false
  ownerPreview.projectId = ''
  ownerPreview.journey = null
}

export function leaveOwnerPreview(): void {
  const projectId = ownerPreview.projectId
  resetOwnerPreview()
  uni.redirectTo({
    url: projectId ? `${P.projectDetail}?id=${encodeURIComponent(projectId)}` : P.projectList
  })
}
