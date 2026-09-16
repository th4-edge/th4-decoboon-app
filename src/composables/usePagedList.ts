import { ref, shallowRef } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import type { PageData } from '@/domains/common/model'

export function usePagedList<T>(
  loader: (current: number, size: number) => Promise<PageData<T>>,
  pageSize = 20
) {
  const items = shallowRef<T[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const loadError = ref('')
  const loadMoreError = ref('')
  const current = ref(1)
  const hasMore = ref(false)

  async function refresh() {
    loading.value = true
    loadError.value = ''
    loadMoreError.value = ''
    try {
      const page = await loader(1, pageSize)
      items.value = page.list
      current.value = 1
      hasMore.value = page.hasMore
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loading.value || loadingMore.value) return
    loadingMore.value = true
    loadMoreError.value = ''
    try {
      const page = await loader(current.value + 1, pageSize)
      items.value = [...items.value, ...page.list]
      current.value += 1
      hasMore.value = page.hasMore
    } catch (error) {
      loadMoreError.value = error instanceof Error ? error.message : '加载失败'
    } finally {
      loadingMore.value = false
    }
  }

  onReachBottom(() => { void loadMore() })

  return {
    items,
    loading,
    loadingMore,
    loadError,
    loadMoreError,
    current,
    hasMore,
    refresh,
    loadMore
  }
}
