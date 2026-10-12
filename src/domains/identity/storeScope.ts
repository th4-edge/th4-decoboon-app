import { computed, reactive } from 'vue'
import { identityApi } from '@/domains/identity/api'
import type { Store } from '@/domains/identity/model'
import { session } from '@/domains/identity/session'

/**
 * App 共享门店维度上下文（`DEC-067` BOSS-STORE-01/10，`DESIGN-BIZ-20261012-002` P0-a）。
 *
 * - 企业范围（BOSS、总部财务）：可选「全部门店」或下钻任一门店，记忆上次选择；
 * - 门店范围（门店财务、店长）：不进门店切换（恒本店），页面不渲染筛选器；
 * - 同一时刻只存在一个门店状态源：各页面不得再各自持有 `storeId`。
 *
 * 哨兵：App 沿用**空字符串**表示「全部门店」；请求层一律转 `undefined`（不传），
 * **绝不把 `'0'` 当门店 ID 传给任何接口**（P0A-06）。
 */

/** 全部门店哨兵（App 既有约定）。 */
export const ALL_STORES = ''

/** 持久化 key。 */
export const STORE_SCOPE_STORAGE_KEY = 'zdq.storeScope.v1'

/** 请求层转换：全部门店与非法值 → `undefined`（不传）。 */
export function requestStoreIdOf(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed === '0') return undefined
  return /^\d+$/.test(trimmed) ? trimmed : undefined
}

export const storeScope = reactive({
  storeId: ALL_STORES,
  stores: [] as Store[],
  loading: false,
  notice: ''
})

/** 是否允许切换门店：仅企业范围角色（BOSS、归属默认总店的总部财务）。 */
export const canSwitchStore = computed(() => {
  const role = session.role
  if (role === 'boss') return true
  if (role !== 'finance') return false
  return session.emp?.store?.defaultStore === true
})

/** 企业范围且门店数 > 1 时才展示筛选器。 */
export const storeScopeVisible = computed(() => canSwitchStore.value && storeScope.stores.length > 1)

export const activeStoreName = computed(() => {
  if (!canSwitchStore.value) return session.emp?.store?.name || '本店'
  if (!storeScope.storeId) return '全部门店'
  return storeScope.stores.find((item) => item.id === storeScope.storeId)?.name || '全部门店'
})

/** 传给服务端的门店维度：全部门店/非企业范围 → `undefined`（不传）。 */
export const storeScopeRequestId = computed<string | undefined>(() => (
  canSwitchStore.value ? requestStoreIdOf(storeScope.storeId) : undefined
))

function persist(value: string): void {
  try {
    uni.setStorageSync(STORE_SCOPE_STORAGE_KEY, value)
  } catch {
    // 本地存储不可用时不影响功能
  }
}

function readStored(): string {
  try {
    const raw = uni.getStorageSync(STORE_SCOPE_STORAGE_KEY)
    return typeof raw === 'string' ? raw.trim() : ''
  } catch {
    return ALL_STORES
  }
}

/** 切换门店（企业范围角色专用）。 */
export function setStoreScope(next: string): void {
  if (!canSwitchStore.value) return
  const value = requestStoreIdOf(next) ?? ALL_STORES
  if (value === storeScope.storeId) return
  storeScope.storeId = value
  storeScope.notice = ''
  persist(value)
}

/**
 * 加载门店候选并校正当前值：记忆中的门店必须仍在本企业门店列表内，
 * 否则回落「全部门店」并提示（不静默出数）；门店范围角色不加载、不切换。
 */
export async function loadStoreScope(): Promise<void> {
  if (!canSwitchStore.value) {
    storeScope.stores = []
    storeScope.storeId = ALL_STORES
    return
  }
  if (storeScope.loading) return
  storeScope.loading = true
  try {
    storeScope.stores = await identityApi.storeList()
  } catch {
    storeScope.stores = []
  } finally {
    storeScope.loading = false
  }
  const stored = readStored()
  const candidate = requestStoreIdOf(stored)
  if (candidate && !storeScope.stores.some((item) => item.id === candidate)) {
    storeScope.notice = '上次选择的门店已不可用，已回落为「全部门店」'
    storeScope.storeId = ALL_STORES
    persist(ALL_STORES)
    return
  }
  storeScope.storeId = candidate ?? ALL_STORES
}

/** 退出登录清理门店记忆。 */
export function clearStoreScope(): void {
  storeScope.storeId = ALL_STORES
  storeScope.stores = []
  storeScope.notice = ''
  try {
    uni.removeStorageSync(STORE_SCOPE_STORAGE_KEY)
  } catch {
    // 忽略
  }
}
