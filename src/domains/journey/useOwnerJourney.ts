import { ref, type Ref } from 'vue'
import { journeyApi } from './api'
import type { CustomerJourney, JourneySection } from './model'
import { ownerPreview } from '@/domains/owner-preview/session'

/**
 * 业主事实页统一数据入口。
 *
 * 业主端的量房、设计、报价、选材、增减项、验收、付款各自是独立页面，
 * 但都基于同一份“我的家”事实装配，避免不同页面口径不一致。
 */
export function useOwnerJourney() {
  const journey = ref<CustomerJourney | null>(null) as Ref<CustomerJourney | null>
  const loading = ref(true)
  const loadingError = ref('')

  async function load(projectId: string) {
    if (!projectId) {
      loading.value = false
      loadingError.value = '缺少工地信息'
      return
    }
    loading.value = true
    loadingError.value = ''
    try {
      if (ownerPreview.active && ownerPreview.journey?.projectId === projectId) {
        journey.value = ownerPreview.journey
        return
      }
      journey.value = ownerPreview.active
        ? await journeyApi.ownerPreviewInfo(projectId)
        : await journeyApi.info(projectId)
    } catch (error) {
      journey.value = null
      loadingError.value = error instanceof Error ? error.message : '房屋档案暂不可确认'
    } finally {
      loading.value = false
    }
  }

  return {
    journey,
    loading,
    loadingError,
    load,
    section: (key: string): JourneySection | undefined =>
      journey.value?.sections.find((item) => item.key === key)
  }
}
