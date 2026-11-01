<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { TOKEN_COLOR } from '@/styles/tokens'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { templateApi } from '@/domains/designtemplate/api'
import type { DesignTemplate, TemplateScope } from '@/domains/designtemplate/model'
import { TEMPLATE_SCOPE_LABELS, TEMPLATE_STATUS_LABELS } from '@/domains/designtemplate/model'
import { usePagedList } from '@/composables/usePagedList'
import { confirm, hideLoading, loading as showLoading, toast, toastError } from '@/composables/toast'
import { openActionSheet } from '@/composables/dialog'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzTag from '@/components/JzTag.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'

const customerId = ref('')
const propertyId = ref('')
const keyword = ref('')
const scopeFilter = ref<'all' | TemplateScope>('all')
const statusFilter = ref<'all' | 'Published' | 'Draft' | 'Disabled'>('all')
const canEditTemplate = computed(() => can(session.role, 'edit:design-template'))
const isManager = computed(() => session.role === 'boss' || session.role === 'storeManager')
const actingId = ref('')
const authorized = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const scopeOptions: Array<{ key: 'all' | TemplateScope; label: string }> = [
  { key: 'all', label: '全部范围' },
  { key: 'Personal', label: '个人' },
  { key: 'Store', label: '门店' },
  { key: 'Company', label: '企业' }
]

const { items, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  async (current, size) => {
    const page = await templateApi.page({
      current,
      size,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      scope: scopeFilter.value === 'all' ? undefined : scopeFilter.value,
      keyword: keyword.value
    })
    return {
      list: page.content,
      total: page.totalElements,
      hasMore: current * size < page.totalElements
    }
  },
  20
)

const contextText = computed(() => propertyId.value
  ? '已绑定当前客户房屋。选择已发布模版后，会生成一份可继续编辑的设计方案。'
  : '当前为浏览模式。请从客户房屋的设计方案页进入，才能将模版生成到该房屋。')

onLoad((query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  if (!can(session.role, 'view:design-template')) {
    toast('当前账号无权查看方案模版')
    return
  }
  customerId.value = String(query?.customerId || '')
  propertyId.value = String(query?.propertyId || '')
  authorized.value = true
})

onShow(() => {
  if (authorized.value) void refresh()
})

onPullDownRefresh(() => {
  if (!authorized.value) {
    uni.stopPullDownRefresh()
    return
  }
  refresh().finally(() => uni.stopPullDownRefresh())
})

watch([keyword, scopeFilter, statusFilter], () => {
  if (!authorized.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void refresh() }, 320)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function canMaintain(template: DesignTemplate): boolean {
  if (!canEditTemplate.value) return false
  if (template.scope === 'Personal') return isManager.value || template.owner?.empId === session.emp?.id
  return isManager.value
}

function openTemplate(template: DesignTemplate): void {
  if (canMaintain(template) && (template.status === 'Draft' || template.currentVersion?.status === 'Draft')) {
    uni.navigateTo({ url: `${P.designTemplateEdit}?templateId=${encodeURIComponent(template.templateId)}` })
    return
  }
  const query = [
    `templateId=${encodeURIComponent(template.templateId)}`,
    customerId.value ? `customerId=${encodeURIComponent(customerId.value)}` : '',
    propertyId.value ? `propertyId=${encodeURIComponent(propertyId.value)}` : ''
  ].filter(Boolean).join('&')
  uni.navigateTo({ url: `${P.designTemplateDetail}?${query}` })
}

function openCreate(): void {
  if (!canEditTemplate.value) return
  uni.navigateTo({ url: `${P.designTemplateEdit}?mode=create` })
}

async function manageTemplate(template: DesignTemplate): Promise<void> {
  if (actingId.value) return
  const options: Array<{ key: string; label: string }> = []
  if (canMaintain(template) && (template.status === 'Draft' || template.currentVersion?.status === 'Draft')) {
    options.push({ key: 'edit', label: '编辑草稿' })
  }
  if (canMaintain(template) && template.status === 'Published' && template.currentVersion?.status === 'Published') {
    options.push({ key: 'version', label: '新建草稿版本' })
  }
  options.push({ key: 'copy', label: '复制为个人模版' })
  if (canMaintain(template) && template.status === 'Published') {
    options.push({ key: 'disable', label: '停用模版' })
  }
  const index = await openActionSheet({ title: versionName(template), itemList: options.map((item) => item.label) })
  if (index === null) return
  const action = options[index]?.key
  if (!action) return
  if (action === 'edit') {
    uni.navigateTo({ url: `${P.designTemplateEdit}?templateId=${encodeURIComponent(template.templateId)}` })
    return
  }
  actingId.value = template.templateId
  try {
    if (action === 'version') {
      showLoading('正在创建草稿版本…')
      const draft = await templateApi.buildVersion({ templateId: template.templateId })
      hideLoading()
      toast(`已创建 V${draft.currentVersion?.version || '—'} 草稿`, 'success')
      uni.navigateTo({ url: `${P.designTemplateEdit}?templateId=${encodeURIComponent(draft.templateId)}` })
      return
    }
    if (action === 'copy') {
      showLoading('正在复制为个人模版…')
      const copied = await templateApi.copy({ templateId: template.templateId })
      hideLoading()
      toast('已复制为个人模版草稿', 'success')
      uni.navigateTo({ url: `${P.designTemplateEdit}?templateId=${encodeURIComponent(copied.templateId)}` })
      return
    }
    if (action === 'disable') {
      const ok = await confirm('停用方案模版', '停用后不可再实例化或编辑，历史报价不受影响；需要继续使用时请先复制。', '停用')
      if (!ok) return
      showLoading('正在停用模版…')
      await templateApi.disable({ templateId: template.templateId })
      hideLoading()
      toast('模版已停用', 'success')
      await refresh()
    }
  } catch (error) {
    hideLoading()
    toastError(error, action === 'version' ? '新建版本失败' : action === 'copy' ? '复制失败' : '停用失败')
  } finally {
    actingId.value = ''
  }
}

function versionName(template: DesignTemplate): string {
  return template.currentVersion?.name || '模版名称暂不可确认'
}

function houseType(template: DesignTemplate): string {
  return template.currentVersion?.houseType || '房型暂不可确认'
}

function areaText(template: DesignTemplate): string {
  const min = template.currentVersion?.areaMin
  const max = template.currentVersion?.areaMax
  if (min === undefined && max === undefined) return '面积不限'
  if (min !== undefined && max !== undefined) return `${min}–${max}㎡`
  return min !== undefined ? `≥${min}㎡` : `≤${max}㎡`
}

function tags(template: DesignTemplate): string[] {
  return (template.currentVersion?.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4)
}

function countText(template: DesignTemplate): string {
  const rooms = template.roomCount == null ? '区域暂不可确认' : `${template.roomCount} 个区域`
  const items = template.itemCount == null ? '分项暂不可确认' : `${template.itemCount} 个分项`
  return `${rooms} · ${items}`
}
</script>

<template>
  <view v-if="authorized" class="tpl">
    <JzPageHeader
      title="方案模版"
      subtitle="已发布模版用于生成方案 · 模版不含价格"
      back
      :right-text="canEditTemplate ? '新建' : ''"
      :right-icon="canEditTemplate ? 'plus' : undefined"
      @right="openCreate"
    />

    <view class="tpl__context jz-card">
      <view class="tpl__context-icon"><JzIcon name="file-text" :size="32" :color="TOKEN_COLOR.primary" /></view>
      <view class="jz-grow">
        <text class="tpl__context-title">选择方案骨架</text>
        <text class="tpl__context-text">{{ contextText }}</text>
      </view>
    </view>

    <view class="tpl__search-wrap">
      <view class="tpl__search">
        <JzIcon name="search" :size="30" :color="TOKEN_COLOR.text3" />
        <input v-model="keyword" placeholder="搜索模版名称、房型或标签" placeholder-class="tpl__placeholder" />
      </view>
    </view>

    <view class="tpl__filters">
      <view
        v-for="option in scopeOptions"
        :key="option.key"
        class="tpl__filter"
        :class="{ 'tpl__filter--active': scopeFilter === option.key }"
        @tap="scopeFilter = option.key"
      >{{ option.label }}</view>
    </view>
    <view v-if="canEditTemplate" class="tpl__filters tpl__filters--status">
      <view class="tpl__filter" :class="{ 'tpl__filter--active': statusFilter === 'all' }" @tap="statusFilter = 'all'">全部状态</view>
      <view class="tpl__filter" :class="{ 'tpl__filter--active': statusFilter === 'Published' }" @tap="statusFilter = 'Published'">已发布</view>
      <view class="tpl__filter" :class="{ 'tpl__filter--active': statusFilter === 'Draft' }" @tap="statusFilter = 'Draft'">草稿</view>
      <view class="tpl__filter" :class="{ 'tpl__filter--active': statusFilter === 'Disabled' }" @tap="statusFilter = 'Disabled'">已停用</view>
    </view>

    <view class="tpl__body">
      <JzSkeleton v-if="loading && !items.length" :rows="4" />
      <view v-else-if="loadError && !items.length" class="jz-card tpl__error">
        <text class="tpl__error-title">方案模版暂不可确认</text>
        <text class="tpl__error-text">{{ loadError }}</text>
        <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="refresh">重新加载</button>
      </view>
      <JzEmpty v-else-if="!items.length" text="暂无匹配方案模版" sub="可调整状态、范围或搜索条件；有维护权限时可直接新建草稿" />
      <view v-else class="tpl__list">
        <view v-for="template in items" :key="template.templateId" class="jz-card tpl__card" @tap="openTemplate(template)">
          <view class="tpl__card-head">
            <view class="jz-grow">
              <text class="tpl__name">{{ versionName(template) }}</text>
              <text class="tpl__meta">{{ houseType(template) }} · {{ areaText(template) }} · V{{ template.currentVersion?.version || '—' }}</text>
            </view>
            <JzTag :text="TEMPLATE_SCOPE_LABELS[template.scope] || '范围待确认'" :color="TOKEN_COLOR.primary" />
            <JzTag v-if="template.status !== 'Published'" :text="TEMPLATE_STATUS_LABELS[template.status] || '状态待确认'" :color="TOKEN_COLOR.warning" />
          </view>
          <view v-if="tags(template).length" class="tpl__tags">
            <text v-for="tag in tags(template)" :key="tag" class="tpl__tag">{{ tag }}</text>
          </view>
          <view class="tpl__foot">
            <text>{{ countText(template) }}</text>
            <text>已使用 {{ template.usageCount ?? '暂不可确认' }} 次</text>
          </view>
          <view class="tpl__open">
            <text>查看区域与分项</text>
            <view class="tpl__open-actions">
              <text class="tpl__more" @tap.stop="manageTemplate(template)">更多</text>
              <JzIcon name="chevron-right" :size="24" :color="TOKEN_COLOR.primary" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <ListFooter v-if="!loadError && items.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    <JzConfirmDialog />
    <view class="tpl__safe-gap" />
  </view>
</template>

<style lang="scss" scoped>
.tpl { min-height: 100vh; background: $jzb-bg-page; padding-bottom: 40rpx; }
.tpl__context { margin: 20rpx 24rpx 0; padding: 22rpx; display: flex; align-items: flex-start; gap: 16rpx; background: $jzb-primary-lightest; }
.tpl__context-icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; background: $jzb-bg-card; }
.tpl__context-title { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 680; }
.tpl__context-text { display: block; margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.55; }
.tpl__search-wrap { padding: 20rpx 24rpx 0; }
.tpl__search { display: flex; align-items: center; gap: 12rpx; min-height: 72rpx; padding: 0 22rpx; background: $jzb-bg-card; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-pill; }
.tpl__search input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; }
.tpl__placeholder { color: $jzb-text-4; }
.tpl__filters { display: flex; gap: 14rpx; padding: 18rpx 24rpx 4rpx; overflow-x: auto; white-space: nowrap; }
.tpl__filters--status { padding-top: 10rpx; padding-bottom: 4rpx; }
.tpl__filter { flex: 0 0 auto; min-height: 58rpx; padding: 0 22rpx; display: flex; align-items: center; border-radius: $jzb-radius-pill; background: $jzb-bg-card; color: $jzb-text-2; font-size: $jzb-font-xs; }
.tpl__filter--active { background: $jzb-primary-lightest; color: $jzb-primary-dark; font-weight: 650; }
.tpl__body { padding: 20rpx 24rpx 0; }
.tpl__list { display: flex; flex-direction: column; gap: 18rpx; }
.tpl__card { padding: 24rpx; }
.tpl__card-head { display: flex; align-items: flex-start; gap: 16rpx; }
.tpl__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.tpl__meta { display: block; margin-top: 7rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.tpl__tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.tpl__tag { padding: 7rpx 14rpx; border-radius: $jzb-radius-pill; background: $jzb-bg-hover; color: $jzb-text-2; font-size: 20rpx; }
.tpl__foot { display: flex; justify-content: space-between; gap: 16rpx; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.tpl__open { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-primary-dark; font-size: $jzb-font-sm; font-weight: 650; }
.tpl__open-actions { display: flex; align-items: center; gap: 16rpx; }
.tpl__more { padding: 8rpx 14rpx; color: $jzb-text-2; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 500; }
.tpl__error { padding: 28rpx; display: flex; flex-direction: column; align-items: center; gap: 12rpx; }
.tpl__error-title { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 650; }
.tpl__error-text { color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.55; text-align: center; }
.tpl__safe-gap { height: env(safe-area-inset-bottom); }
</style>
