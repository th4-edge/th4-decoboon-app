<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { laborApi } from '@/domains/labor/api'
import type { Worker } from '@/domains/labor/model'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

const keyword = ref('')
const items = ref<Worker[]>([])
const loading = ref(false)
const loadError = ref('')
const editable = computed(() => can(session.role, 'edit:worker'))
const hasKeyword = computed(() => keyword.value.trim().length > 0)

/** 输入即搜：320ms 防抖，避免逐字请求；仅保留最后一次请求结果，防止旧响应覆盖新结果。 */
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  const seq = ++requestSeq
  loading.value = true
  loadError.value = ''
  try {
    const list = await laborApi.workers({ keyword: keyword.value.trim() || undefined })
    if (seq !== requestSeq) return
    items.value = list
  } catch (error) {
    if (seq !== requestSeq) return
    loadError.value = error instanceof Error ? error.message : '工人档案加载失败'
    toastError(error, '工人档案加载失败')
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load() }, 320)
}

function onSearchConfirm() {
  if (searchTimer) clearTimeout(searchTimer)
  void load()
}

function clearKeyword() {
  if (searchTimer) clearTimeout(searchTimer)
  keyword.value = ''
  void load()
}

function edit(item?: Worker) {
  if (!editable.value) { uni.showToast({ title: '仅项目经理可维护工人信息', icon: 'none' }); return }
  uni.navigateTo({ url: item?.id ? `${P.laborWorkerEdit}?id=${item.id}` : P.laborWorkerEdit })
}

function display(value?: string) {
  return value && value.trim() ? value : '—'
}
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="工人档案" subtitle="企业共享；身份证与银行卡按角色显示" :right-text="editable ? '新增' : ''" :right-icon="editable ? 'plus' : undefined" @right="edit()" />

    <view class="wk__head">
      <view class="wk__search">
        <view class="wk__search-icon"><JzIcon name="search" :size="34" :color="TOKEN_COLOR.text3" /></view>
        <input
          v-model="keyword"
          placeholder="搜索姓名 / 手机号 / 工种"
          placeholder-class="wk__ph"
          confirm-type="search"
          @input="onKeywordInput"
          @confirm="onSearchConfirm"
        />
        <view v-if="hasKeyword" class="wk__clear" @tap="clearKeyword">
          <JzIcon name="close" :size="26" :color="TOKEN_COLOR.text3" />
        </view>
      </view>
    </view>

    <view class="fin-body">
      <PageState v-if="loadError && !items.length" state="error" title="工人档案加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !items.length" :rows="4" />

      <view v-for="item in items" :key="item.id" class="fin-card">
        <view class="fin-card__top">
          <view class="fin-card__title">
            {{ item.name }}
            <text class="fin-card__sub">{{ item.trade || '工种未填' }} · {{ item.status === 'disabled' ? '已停用' : '在职' }}</text>
          </view>
          <view v-if="editable" class="fin-card__action" @tap="edit(item)">
            <JzIcon name="edit" :size="28" :color="TOKEN_COLOR.primary" />
          </view>
        </view>
        <view class="fin-card__facts">
          <view class="fin-fact"><JzIcon name="user" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ display(item.phone) }}</text></view>
          <view class="fin-fact"><JzIcon name="shield-check" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ display(item.idCardNo) }}</text></view>
          <view class="fin-fact"><JzIcon name="wallet" :size="22" :color="TOKEN_COLOR.text3" /><text>{{ display(item.bankAccount) }}</text></view>
        </view>
        <view v-if="item.remark" class="fin-card__foot"><text class="jz-caption">{{ item.remark }}</text></view>
      </view>

      <view v-if="!loading && !items.length" class="fin-empty">
        <JzEmpty
          v-if="hasKeyword"
          text="没有匹配的工人"
          sub="换个姓名、手机号或工种试试"
        />
        <JzEmpty
          v-else
          text="暂无工人档案"
          sub="项目经理登记工人后，发工资即可直接出凭证"
        />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.wk__head { padding: 20rpx $jzb-page-pad 8rpx; }
.wk__search {
  display: flex; align-items: center; height: 88rpx; padding: 0 24rpx;
  background: $jzb-text-inverse; border: 1rpx solid rgba(15, 23, 42, .045);
  border-radius: $jzb-radius-pill; box-shadow: $jzb-shadow-xs;
}
.wk__search-icon { width: 40rpx; height: 40rpx; margin-right: 8rpx; display: flex; align-items: center; justify-content: center; }
.wk__search input { flex: 1; min-width: 0; font-size: $jzb-font; }
.wk__ph { color: $jzb-text-4; }
.wk__clear {
  width: 44rpx; height: 44rpx; margin-left: 8rpx; display: flex; align-items: center;
  justify-content: center; border-radius: 50%; background: $jzb-bg-page;
}
</style>
