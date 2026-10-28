import { watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { loadStoreScope, storeScope } from '@/domains/identity/storeScope'

/**
 * 财务/薪酬页共享门店维度：进入页面时加载候选，切换时重新读取当前页数据。
 * 请求参数统一由领域 API 从 storeScopeRequestId 读取，页面不维护第二份 storeId。
 */
export function useFinanceStoreScope(reload: () => void | Promise<void>): void {
  onShow(() => { void loadStoreScope() })
  watch(() => storeScope.storeId, () => { void reload() })
}
