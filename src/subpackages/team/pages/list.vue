<script setup lang="ts">
function go(url: string) { uni.navigateTo({ url }) }
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Employee } from '@/domains/identity/model'
import { ROLE_META } from '@/roles/catalog'
import { can } from '@/roles/permission'
import { identityApi } from '@/domains/identity/api'
import { toast } from '@/composables/toast'
import JzAvatar from '@/components/JzAvatar.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzTag from '@/components/JzTag.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import ListFooter from '@/components/ListFooter/ListFooter.vue'
import PageState from '@/components/PageState/PageState.vue'
import { usePagedList } from '@/composables/usePagedList'

const { items: list, loading, loadingMore, loadError, loadMoreError, hasMore, refresh, loadMore } = usePagedList(
  (current, size) => identityApi.employeePage({ current, size }),
  20
)
const filter = ref<'all' | 'boss' | 'storeManager' | 'teamLeader' | 'designer' | 'pm' | 'marketer'>('all')
const FILTERS = [
  { key: 'all', label: '全部' }, { key: 'boss', label: '负责人' }, { key: 'storeManager', label: '店长' },
  { key: 'teamLeader', label: '团队长' },
  { key: 'designer', label: '设计师' }, { key: 'pm', label: '项目经理' }, { key: 'marketer', label: '顾问' }
] as const

onLoad(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'view:team')) {
    toast('当前账号无权查看企业团队')
    setTimeout(() => uni.navigateBack(), 500)
  }
})
onShow(() => { if (can(session.role, 'view:team')) refresh() })
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

const shown = computed(() => filter.value === 'all' ? list.value : list.value.filter((e) => e.role === filter.value))
const canInvite = computed(() => can(session.role || 'boss', 'act:inviteMember'))

</script>

<template>
  <view class="team">
    <view class="team__head jz-card">
      <text class="team__head-name">{{ session.company?.name }}</text>
      <text class="team__head-sub">{{ session.role === 'teamLeader' ? (session.emp?.team?.name || '当前团队') : session.role === 'storeManager' ? (session.emp?.store?.name || '当前门店') : (session.company?.storeName || session.company?.city || '企业团队') }} · 共 {{ list.length }} 人</text>
    </view>

    <scroll-view scroll-x class="team__filters" :show-scrollbar="false">
      <view class="team__filter-row">
        <view v-for="f in FILTERS" :key="f.key" class="team__filter" :class="{ 'team__filter--on': filter === f.key }" @tap="filter = f.key">
          {{ f.label }}
        </view>
      </view>
    </scroll-view>

    <view class="team__list">
      <PageState v-if="loadError && !list.length" state="error" title="成员加载失败" :subtitle="loadError" @retry="refresh" />
      <view v-for="e in shown" :key="e.id" class="jz-card team__item">
        <JzAvatar :src="e.avatarUrl || ''" :name="e.name" :color="ROLE_META[e.role as keyof typeof ROLE_META]?.color || '#16A394'" :size="80" />
        <view class="jz-grow team__who">
          <view class="jz-row">
            <text class="team__name">{{ e.name }}</text>
            <JzTag :text="ROLE_META[e.role as keyof typeof ROLE_META]?.short || e.role" :color="ROLE_META[e.role as keyof typeof ROLE_META]?.color || '#16A394'" />
          </view>
          <text class="team__meta">{{ e.title }} · 入职 {{ e.joinDate }}</text>
        </view>
        <text class="team__me" v-if="e.id === session.emp?.id">我</text>
      </view>
      <view v-if="!loadError && !shown.length" class="jz-card"><JzEmpty text="该岗位暂无成员" /></view>
      <ListFooter v-if="!loadError && shown.length" :loading="loadingMore" :has-more="hasMore" :error="loadMoreError" @retry="loadMore" />
    </view>

    <JzFloatAdd v-if="canInvite" text="邀请成员" @tap="go(P.companyInvite)" />
  </view>
</template>


<style lang="scss" scoped>
.team { padding-bottom: 140rpx; }
.team__head { margin: 24rpx; padding: 28rpx; display: flex; flex-direction: column; }
.team__head-name { font-size: $jzb-font-xl; font-weight: 700; }
.team__head-sub { margin-top: 8rpx; font-size: $jzb-font-sm; color: $jzb-text-3; }
.team__filters { width: 100%; white-space: nowrap; background: #fff; }
.team__filter-row { display: inline-flex; padding: 16rpx $jzb-page-pad; }
.team__filter { padding: 8rpx 26rpx; margin-right: 14rpx; font-size: $jzb-font-sm; color: $jzb-text-2; background: $jzb-bg-page; border-radius: $jzb-radius-pill; }
.team__filter--on { background: $jzb-primary; color: #fff; }
.team__list { padding: 20rpx $jzb-page-pad; }
.team__item { display: flex; flex-direction: row; align-items: center; padding: 24rpx; margin-bottom: 16rpx; }
.team__who { margin-left: 20rpx; }
.team__name {team__name overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.team__meta { display: block; margin-top: 6rpx; font-size: $jzb-font-xs; color: $jzb-text-3; }
.team__me { color: $jzb-primary; font-size: $jzb-font-xs; }
</style>
