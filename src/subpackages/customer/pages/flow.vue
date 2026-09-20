<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn } from '@/domains/identity/session'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import { designApi } from '@/domains/design/api'
import type { DesignScheme, TalkPlan } from '@/domains/design/model'
import { projectApi } from '@/domains/project/api'
import type { Project } from '@/domains/project/model'
import { propertyApi } from '@/domains/property/api'
import type { Property } from '@/domains/property/model'
import { tradeApi } from '@/domains/trade/api'
import type { Contract, Quote } from '@/domains/trade/model'
import { money } from '@/core/format'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import { toastError } from '@/composables/toast'

const customerId = ref('')
const propertyId = ref('')
const customer = ref<Customer | null>(null)
const properties = ref<Property[]>([])
const designs = ref<DesignScheme[]>([])
const quotes = ref<Quote[]>([])
const projects = ref<Project[]>([])
const contracts = ref<Contract[]>([])
const talks = ref<TalkPlan[]>([])
const loading = ref(false)

const activeProperty = computed(() => properties.value.find((item) => item.id === propertyId.value) || null)
const propertyQuotes = computed(() => propertyId.value ? quotes.value.filter((item) => item.property?.id === propertyId.value) : quotes.value)
const propertyProjects = computed(() => propertyId.value ? projects.value.filter((item) => item.property?.id === propertyId.value) : projects.value)
const quoteIds = computed(() => new Set(propertyQuotes.value.map((item) => item.id)))
const projectIds = computed(() => new Set(propertyProjects.value.map((item) => item.id)))
const activeContracts = computed(() => contracts.value.filter((item) => {
  if (item.property?.id === propertyId.value) return true
  if (item.quoteId && quoteIds.value.has(item.quoteId)) return true
  return Boolean(item.projectId && projectIds.value.has(item.projectId))
}))
const activeTalks = computed(() => talks.value.filter((item) => {
  if (item.property?.id === propertyId.value) return true
  if (item.quote?.id && quoteIds.value.has(item.quote.id)) return true
  return !propertyId.value
}))

onLoad((query) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  customerId.value = query?.customerId || ''
  propertyId.value = query?.propertyId || ''
})

onShow(() => { if (customerId.value) void load() })

async function load() {
  loading.value = true
  try {
    const [customerValue, propertyValues, designValues, quoteValues, projectValues] = await Promise.all([
      crmApi.info(customerId.value),
      propertyApi.list(customerId.value).catch(() => []),
      designApi.schemes(customerId.value).catch(() => []),
      tradeApi.quotes({ customerId: customerId.value }).catch(() => []),
      projectApi.list({ customerId: customerId.value }).catch(() => [])
    ])
    customer.value = customerValue
    properties.value = propertyValues
    designs.value = designValues
    quotes.value = quoteValues
    projects.value = projectValues
    const contractResults = await Promise.all([
      ...quoteValues.map((item) => tradeApi.contractByQuote(item.id).catch(() => null)),
      ...projectValues.map((item) => tradeApi.contractByProject(item.id).catch(() => null))
    ])
    const uniqueContracts = new Map<string, Contract>()
    for (const item of contractResults) {
      if (item) uniqueContracts.set(item.id, item)
    }
    contracts.value = [...uniqueContracts.values()]
    const talkGroups = await Promise.all(designValues.map((item) => designApi.talks(item.id).catch(() => [])))
    talks.value = talkGroups.flat()
  } catch (error) {
    toastError(error, '业务流转加载失败')
  } finally {
    loading.value = false
  }
}

function openDesign(item: DesignScheme) {
  uni.navigateTo({ url: `${P.designScheme}?designId=${item.id}&customerId=${customerId.value}&propertyId=${propertyId.value}` })
}

function openQuote(item: Quote) {
  uni.navigateTo({ url: `${P.quoteDetail}?id=${item.id}` })
}

function openTalk(item: TalkPlan) {
  uni.navigateTo({ url: `${P.designTalk}?talkId=${item.id}&designId=${item.design?.id || ''}&quoteId=${item.quote?.id || ''}` })
}

function openContract(item: Contract) {
  if (item.quoteId) uni.navigateTo({ url: `${P.quoteDetail}?id=${item.quoteId}` })
  else if (item.projectId) uni.navigateTo({ url: `${P.projectDetail}?id=${item.projectId}` })
}

function openProject(item: Project) {
  uni.navigateTo({ url: `${P.projectDetail}?id=${item.id}` })
}

function openPlan(item: Project) {
  uni.navigateTo({ url: `${P.projectPlan}?id=${item.id}` })
}

function statusText(value?: string) {
  const map: Record<string, string> = {
    draft: '草稿', submitted: '待客户确认', accepted: '客户已接受', rejected: '已驳回', superseded: '已被替代', converted: '已转项目',
    signed: '已签署', effective: '已生效', active: '履约中', completed: '已完工', settled: '已结算', closed: '已关闭', terminated: '已终止',
    preparing: '待开工', ongoing: '施工中', suspended: '已停工', accepting: '待验收', finished: '已完工',
    ready: '待谈单', presented: '已讲解', selected: '客户已选中', archived: '已归档', generated: '已生成', published: '已发布'
  }
  return map[String(value || '')] || value || '-'
}
</script>

<template>
  <view class="flow">
    <view class="jz-card flow__head">
      <text class="flow__eyebrow">签约后业务流转</text>
      <text class="flow__title">{{ customer?.name || '客户' }}</text>
      <text class="flow__sub">{{ activeProperty?.address || activeProperty?.community || '当前房屋' }} · 业务员只读查看后续推进</text>
    </view>

    <view class="jz-section"><text class="jz-section__title">设计方案</text><text class="jz-section__more">{{ designs.length }} 个</text></view>
    <view v-if="designs.length" class="jz-card flow__list">
      <view v-for="item in designs" :key="item.id" class="flow__item" @tap="openDesign(item)">
        <view class="jz-grow"><text class="flow__item-title">{{ item.name }}</text><text class="flow__item-sub">{{ item.no }} · {{ statusText(item.status) }} · {{ item.area || 0 }}㎡</text></view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>
    </view>
    <JzEmpty v-else text="暂无设计方案" sub="设计师接手后会在这里形成方案" />

    <view class="jz-section"><text class="jz-section__title">报价</text><text class="jz-section__more">{{ propertyQuotes.length }} 份</text></view>
    <view v-if="propertyQuotes.length" class="jz-card flow__list">
      <view v-for="item in propertyQuotes" :key="item.id" class="flow__item" @tap="openQuote(item)">
        <view class="jz-grow"><text class="flow__item-title">{{ item.title || item.no }}</text><text class="flow__item-sub">{{ statusText(item.status) }} · {{ money(item.amount) }}</text></view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>
    </view>
    <JzEmpty v-else text="暂无报价" sub="报价由设计师推进，业务员只读查看" />

    <view class="jz-section"><text class="jz-section__title">谈单 PPT</text><text class="jz-section__more">{{ activeTalks.length }} 份</text></view>
    <view v-if="activeTalks.length" class="jz-card flow__list">
      <view v-for="item in activeTalks" :key="item.id" class="flow__item" @tap="openTalk(item)">
        <view class="jz-grow"><text class="flow__item-title">{{ item.title }}</text><text class="flow__item-sub">{{ item.no }} · {{ statusText(item.status) }} · V{{ item.version }}</text></view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>
    </view>
    <JzEmpty v-else text="暂无谈单 PPT" sub="设计方案完成讲解后可生成谈单材料" />

    <view class="jz-section"><text class="jz-section__title">合同</text><text class="jz-section__more">{{ activeContracts.length }} 份</text></view>
    <view v-if="activeContracts.length" class="jz-card flow__list">
      <view v-for="item in activeContracts" :key="item.id" class="flow__item" @tap="openContract(item)">
        <view class="jz-grow"><text class="flow__item-title">{{ item.no }}</text><text class="flow__item-sub">{{ statusText(item.status) }} · {{ money(item.currentAmount || item.amount) }}</text></view>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" />
      </view>
    </view>
    <JzEmpty v-else text="暂无合同" sub="客户接受报价后进入合同签署" />

    <view class="jz-section"><text class="jz-section__title">项目与工地</text><text class="jz-section__more">{{ propertyProjects.length }} 个</text></view>
    <view v-if="propertyProjects.length" class="jz-card flow__list">
      <view v-for="item in propertyProjects" :key="item.id" class="flow__item">
        <view class="jz-grow" @tap="openProject(item)"><text class="flow__item-title">{{ item.name }}</text><text class="flow__item-sub">{{ item.currentStageName || statusText(item.status) }} · 进度 {{ item.progress || 0 }}%</text></view>
        <button class="flow__plan-btn" @tap.stop="openPlan(item)">施工计划</button>
        <JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" @tap="openProject(item)" />
      </view>
    </view>
    <JzEmpty v-else text="暂无项目" sub="合同生效后会自动形成唯一项目" />

    <view class="jz-tabbar-gap" />
  </view>
</template>

<style lang="scss" scoped>
.flow { min-height: 100vh; padding: 24rpx 24rpx 60rpx; background: $jzb-bg-page; }
.flow__head { padding: 30rpx; background: linear-gradient(145deg, $jzb-primary-lightest, $jzb-text-inverse); }
.flow__eyebrow { display: block; color: $jzb-primary-dark; font-size: 20rpx; font-weight: 720; letter-spacing: 2rpx; }
.flow__title { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 760; }
.flow__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.flow__list { padding: 6rpx 24rpx; }
.flow__item { display: flex; align-items: center; gap: 16rpx; min-height: 100rpx; border-bottom: 1rpx solid $jzb-border-light; }
.flow__item:last-child { border-bottom: 0; }
.flow__item-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.flow__item-sub { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.flow__plan-btn { flex: 0 0 auto; padding: 8rpx 16rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border: 0; border-radius: $jzb-radius-pill; font-size: 20rpx; }
</style>
