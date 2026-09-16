<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { toast, toastError } from '@/composables/toast'
import { billingApi } from '@/subpackages/subscription/domains/billing/api'
import type {
  BillingOrder, PlanAddon, PlanAddonType, PlanModule, SubscriptionInfo,
  SubscriptionPlan, WechatPayParams
} from '@/subpackages/subscription/domains/billing/model'
import { identityApi } from '@/domains/identity/api'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import JzEmpty from '@/components/JzEmpty.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTag from '@/components/JzTag.vue'

const info = ref<SubscriptionInfo | null>(null)
const loading = ref(false)
const paying = ref(false)
const stores = ref<{ id: string; name: string; addr?: string; defaultStore?: boolean }[]>([])
const queryingOrderNo = ref('')
const plans = ref<SubscriptionPlan[]>([])
const addons = ref<PlanAddon[]>([])
const orders = ref<BillingOrder[]>([])
const selectedPlanCode = ref('')
const seatQuantity = ref(0)
const storeQuantity = ref(0)
const orderFilter = ref<'all' | 'pending' | 'granted'>('all')

const statusMeta = computed(() => {
  if (info.value?.expired || info.value?.status === 'expired') {
    return { text: '订阅已到期', short: '已到期', color: '#E5484D' }
  }
  switch (info.value?.status) {
    case 'trial': return { text: '基础版试用中', short: '试用', color: '#E67E22' }
    case 'active': return { text: '订阅使用中', short: '使用中', color: '#16A394' }
    case 'frozen': return { text: '订阅已冻结', short: '冻结', color: '#8A5CC7' }
    case 'closed': return { text: '订阅已关闭', short: '关闭', color: '#7A7F87' }
    default: return { text: '订阅已到期', short: '已到期', color: '#E5484D' }
  }
})

const selectedPlan = computed(() => plans.value.find((plan) => plan.code === selectedPlanCode.value))
const seatAddon = computed(() => addons.value.find((addon) => addon.type === 'seats'))
const storeAddon = computed(() => addons.value.find((addon) => addon.type === 'stores'))
const addonAmount = computed(() =>
  seatQuantity.value * (seatAddon.value?.unitPrice || 0)
  + storeQuantity.value * (storeAddon.value?.unitPrice || 0))
const orderAmount = computed(() => (selectedPlan.value?.price || 0) + addonAmount.value)
const seatPercent = computed(() => percent(info.value?.usedSeats, info.value?.effectiveMaxSeats))
const storePercent = computed(() => percent(info.value?.usedStores, info.value?.effectiveMaxStores))
const modules = computed(() => (info.value?.planVersion?.modules || info.value?.plan?.modules || []).map(moduleText))
const filteredOrders = computed(() => orders.value.filter((order) => {
  if (orderFilter.value === 'all') return true
  if (orderFilter.value === 'pending') return order.status === 'pending'
  return order.status === 'granted' || order.status === 'paid'
}))
const renewalHint = computed(() => {
  if (!info.value) return '开通套餐后开始积累完整经营数据'
  if (info.value.status === 'trial') return `基础版试用还剩 ${info.value.remainingDays} 天，现在续费不中断业务`
  if (!info.value.writable || info.value.expired) return '订阅已到期，续费后立即恢复写入和协作能力'
  return `当前订阅剩余 ${info.value.remainingDays} 天，支持提前续费叠加有效期`
})

onLoad(() => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'view:subscription')) {
    toast('当前账号无权查看订阅信息')
    setTimeout(() => uni.navigateBack(), 500)
  }
})
onShow(() => {
  void loadStores()
  if (can(session.role, 'view:subscription')) refresh()
})
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

async function refresh() {
  loading.value = true
  try {
    const [current, planList, addonList, orderList] = await Promise.all([
      billingApi.current(), billingApi.plans(), billingApi.addons(), billingApi.orders()
    ])
    info.value = current
    plans.value = planList
    addons.value = addonList
    orders.value = orderList
    const currentCode = current?.planVersion?.code || current?.plan?.code
    if (!selectedPlanCode.value || !planList.some((plan) => plan.code === selectedPlanCode.value)) {
      selectedPlanCode.value = planList.find((plan) => plan.code === currentCode)?.code
        || planList.find((plan) => plan.recommended)?.code
        || planList[0]?.code
        || ''
    }
  } catch (error) {
    toastError(error, '订阅信息加载失败')
  } finally {
    loading.value = false
  }
}

function selectPlan(plan: SubscriptionPlan) {
  selectedPlanCode.value = plan.code
}

function changeQuantity(type: PlanAddonType, delta: number) {
  const addon = addons.value.find((item) => item.type === type)
  const max = addon?.maxQuantity || 0
  if (type === 'seats') seatQuantity.value = clamp(seatQuantity.value + delta, 0, max)
  else storeQuantity.value = clamp(storeQuantity.value + delta, 0, max)
}

async function submitOrder() {
  const plan = selectedPlan.value
  if (!plan || paying.value) {
    if (!plan) toast('请先选择订阅套餐')
    return
  }
  paying.value = true
  let order: BillingOrder | undefined
  try {
    order = await billingApi.createOrder({
      planCode: plan.code,
      seatQuantity: seatQuantity.value,
      storeQuantity: storeQuantity.value,
      payChannel: 'Wx'
    })
    orders.value = [order, ...orders.value]
    await requestWechatPayment(await billingApi.prepay(order.orderNo))
    await waitForPayment(order.orderNo)
  } catch (error) {
    if (isPaymentCancel(error)) toast('订单已保留，可稍后继续支付')
    else toastError(error, '支付发起失败，订单已保留')
    await refreshOrders()
  } finally {
    paying.value = false
  }
}

async function continuePay(order: BillingOrder) {
  if (paying.value) return
  paying.value = true
  try {
    await requestWechatPayment(await billingApi.prepay(order.orderNo))
    await waitForPayment(order.orderNo)
  } catch (error) {
    if (isPaymentCancel(error)) toast('已取消本次支付')
    else toastError(error, '支付发起失败')
    await refreshOrders()
  } finally {
    paying.value = false
  }
}

async function queryPayment(order: BillingOrder) {
  if (queryingOrderNo.value) return
  queryingOrderNo.value = order.orderNo
  try {
    const latest = await billingApi.orderInfo(order.orderNo)
    replaceOrder(latest)
    if (latest.status === 'granted' || latest.status === 'paid') {
      toast('支付已确认，订阅权益已生效', 'success')
      await refresh()
    } else {
      toast('暂未查询到成功支付结果')
    }
  } catch (error) {
    toastError(error, '支付结果查询失败')
  } finally {
    queryingOrderNo.value = ''
  }
}

async function waitForPayment(orderNo: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const latest = await billingApi.orderInfo(orderNo)
    replaceOrder(latest)
    if (latest.status === 'granted' || latest.status === 'paid') {
      toast('支付成功，订阅权益已生效', 'success')
      await refresh()
      return
    }
    await delay(attempt === 0 ? 500 : 1200)
  }
  toast('支付结果确认中，请稍后在订单记录中查询')
  await refreshOrders()
}

async function refreshOrders() {
  try {
    orders.value = await billingApi.orders()
  } catch {
    // 保留当前订单列表，避免支付完成后的页面闪空。
  }
}

function requestWechatPayment(params: WechatPayParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestPayment = uni.requestPayment
    if (typeof requestPayment !== 'function') {
      reject(new Error('当前环境不支持微信支付，请在微信小程序内操作'))
      return
    }
    requestPayment({
      provider: 'wxpay',
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: () => resolve(),
      fail: (error) => reject(error)
    })
  })
}

function replaceOrder(order: BillingOrder) {
  const index = orders.value.findIndex((item) => item.orderNo === order.orderNo)
  if (index >= 0) orders.value.splice(index, 1, order)
  else orders.value.unshift(order)
}

function orderStatusMeta(status: BillingOrder['status']) {
  return ({
    pending: { text: '待支付', color: '#E67E22' },
    paid: { text: '已支付', color: '#16A394' },
    granted: { text: '已开通', color: '#16A394' },
    expired: { text: '已过期', color: '#7A7F87' },
    cancelled: { text: '已取消', color: '#7A7F87' },
    refunded: { text: '已退款', color: '#8A5CC7' }
  })[status]
}

function orderItemsText(order: BillingOrder) {
  if (!order.items.length) return order.planName || '订阅套餐'
  return order.items.map((item) => `${item.productName} × ${item.quantity}`).join(' + ')
}

function planFeature(plan: SubscriptionPlan) {
  return plan.highlights.length ? plan.highlights : [
    `${capacityText(0, plan.maxSeats).replace(/^0 \/ /, '')} 个员工席位`,
    plan.maxStores >= 9999 ? '门店数量不限' : `${plan.maxStores} 家门店`,
    `${plan.modules.length || 0} 个业务模块`
  ]
}

function isCurrent(plan: SubscriptionPlan) {
  const currentCode = info.value?.planVersion?.code || info.value?.plan?.code
  return !!currentCode && plan.code === currentCode
}

function isPaymentCancel(error: unknown) {
  const message = String((error as { errMsg?: string } | null)?.errMsg || (error instanceof Error ? error.message : ''))
  return message.toLowerCase().includes('cancel')
}

function percent(used?: number, max?: number) {
  if (!max || max <= 0 || max >= 9999) return 0
  return Math.min(100, Math.round(((used || 0) / max) * 100))
}

function capacityText(used?: number, max?: number) {
  if (!max || max <= 0 || max >= 9999) return `${used || 0} / 不限`
  return `${used || 0} / ${max}`
}

function money(value: number) {
  const amount = (value || 0) / 100
  return `¥${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function priceInteger(value: number) {
  return Math.floor(value / 100)
}

function formatTime(value?: string) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

function moduleText(module: PlanModule) {
  return ({
    crm: '客户经营',
    design: '设计转化',
    quote: '报价合同',
    project: '项目履约',
    supply: '供应链与成本',
    finance: '财务结算',
    analytics: '经营分析',
    ai: 'AI辅助',
    api: '开放接口'
  })[module]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(max, min))
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
async function loadStores() {
  try {
    stores.value = await identityApi.storeList()
  } catch {
    stores.value = []
  }
}
</script>

<template>
  <view class="subscription">
    <JzPageHeader title="订阅中心" subtitle="套餐购买、续费、订单与经营权益" />

    <view v-if="info" class="subscription__content">
      <view class="subscription__hero">
        <view class="subscription__hero-glow" />
        <view class="subscription__hero-top">
          <view class="subscription__hero-copy">
            <view class="subscription__eyebrow">
              <JzTag :text="statusMeta.text" :color="statusMeta.color" size="md" dot />
              <text v-if="info.trialActivated && info.status === 'trial'" class="subscription__trial">新企专享</text>
            </view>
            <text class="subscription__plan">{{ info.planVersion?.name || info.plan?.name || '未配置套餐' }}</text>
            <view class="subscription__price">
              <text class="subscription__price-value">{{ money(info.planVersion?.price || info.plan?.price || 0) }}</text>
              <text class="subscription__price-unit">/ 年</text>
            </view>
            <text class="subscription__renewal-tip">{{ renewalHint }}</text>
          </view>
          <view class="subscription__days-card">
            <text class="subscription__days">{{ info.remainingDays }}</text>
            <text class="subscription__days-unit">天可用</text>
          </view>
        </view>

        <view v-if="!info.writable" class="subscription__expired-tip">
          当前仅支持查询历史数据，完成续费后立即恢复新增、编辑、审批和协作能力。
        </view>
      </view>

      <!-- 服务周期：从 hero 拆出，独立成卡片，层次更清晰 -->
      <view class="jz-section">
        <text class="jz-section__title">服务周期</text>
        <text class="subscription__section-subtitle">到期后数据保留，续费即恢复</text>
      </view>
      <view class="jz-card subscription__period">
        <view class="subscription__period-row">
          <text class="subscription__period-label">服务到期</text>
          <text class="subscription__period-value">{{ formatTime(info.serviceEndTime) }}</text>
        </view>
        <view class="subscription__period-row">
          <text class="subscription__period-label">上次续费</text>
          <text class="subscription__period-value">{{ formatTime(info.lastRenewTime) || '暂无记录' }}</text>
        </view>
        <view class="subscription__period-row">
          <text class="subscription__period-label">剩余可用</text>
          <text class="subscription__period-value">{{ info.remainingDays }} 天</text>
        </view>
      </view>

      <view class="subscription__benefits">
        <view class="subscription__benefit">
          <JzIcon name="shield-check" :size="34" color="#16A394" />
          <text class="subscription__benefit-title">数据持续保留</text>
          <text class="subscription__benefit-desc">到期不删除，续费即恢复</text>
        </view>
        <view class="subscription__benefit">
          <JzIcon name="wallet" :size="34" color="#E67E22" />
          <text class="subscription__benefit-title">价格透明</text>
          <text class="subscription__benefit-desc">微信安全支付，无隐藏费用</text>
        </view>
        <view class="subscription__benefit">
          <JzIcon name="wrench" :size="34" color="#5B6BD6" />
          <text class="subscription__benefit-title">上线陪跑</text>
          <text class="subscription__benefit-desc">专业版、旗舰版远程支持</text>
        </view>
      </view>

      <view class="subscription__capacity jz-card">
        <view class="subscription__section-head">
          <view>
            <text class="subscription__section-title">当前套餐用量</text>
            <text class="subscription__section-subtitle">席位和门店不足时，可直接在下方加购</text>
          </view>
          <JzTag :text="statusMeta.short" :color="statusMeta.color" />
        </view>
        <view class="subscription__metric">
          <view class="subscription__metric-head">
            <text>员工席位</text>
            <text>{{ capacityText(info.usedSeats, info.effectiveMaxSeats) }}，含加购 {{ info.extraSeats }} 个</text>
          </view>
          <view class="subscription__progress"><view class="subscription__progress-inner" :style="{ width: `${seatPercent}%` }" /></view>
        </view>
        <view class="subscription__metric">
          <view class="subscription__metric-head">
            <text>企业门店</text>
            <text>{{ capacityText(info.usedStores, info.effectiveMaxStores) }}，含加购 {{ info.extraStores }} 家</text>
          </view>
          <view class="subscription__progress"><view class="subscription__progress-inner" :style="{ width: `${storePercent}%` }" /></view>
        </view>
        <view class="subscription__modules">
          <JzTag v-for="item in modules" :key="item" :text="item" size="md" />
        </view>
      </view>

      <!-- 门店：基础版仅默认门店，不提供新增入口 -->
      <view class="jz-section">
        <text class="jz-section__title">门店</text>
        <text class="subscription__section-subtitle">{{ stores.length }} / {{ info.effectiveMaxStores || 1 }} 家</text>
      </view>
      <view class="jz-card subscription__stores">
        <view v-for="store in stores" :key="store.id" class="subscription__store">
          <JzIcon name="building" :size="32" color="#0E8A7D" />
          <view class="subscription__store-info">
            <text class="subscription__store-name">{{ store.name }}</text>
            <text class="subscription__store-addr">{{ store.addr || '未填写地址' }}</text>
          </view>
          <JzTag v-if="store.defaultStore" text="默认门店" color="#0E8A7D" />
        </view>
        <view v-if="!stores.length" class="subscription__store-empty">暂未获取到门店信息</view>
        <text class="subscription__store-tip">
          当前套餐支持 1 个默认门店，不支持新增门店；如需多门店经营请升级套餐。
        </text>
      </view>

      <view class="subscription__section-head subscription__section-head--outside">
        <view>
          <text class="subscription__section-title">选择订阅方案</text>
          <text class="subscription__section-subtitle">点击卡片选择，年付有效期内不限业务单据量</text>
        </view>
        <JzTag text="支持续费叠加" color="#5B6BD6" />
      </view>

      <scroll-view class="subscription__plans" scroll-x :show-scrollbar="false">
        <view class="subscription__plan-track">
          <view
            v-for="plan in plans"
            :key="plan.code"
            class="subscription__plan-card"
            :class="{
              'subscription__plan-card--selected': selectedPlanCode === plan.code,
              'subscription__plan-card--recommended': plan.recommended
            }"
            @tap="selectPlan(plan)"
          >
            <view class="subscription__plan-ribbon" v-if="plan.badge">{{ plan.badge }}</view>
            <view class="subscription__plan-head">
              <view>
                <text class="subscription__plan-name">{{ plan.name }}</text>
                <text class="subscription__plan-tagline">{{ plan.tagline || plan.description }}</text>
              </view>
              <view v-if="isCurrent(plan)" class="subscription__current-mark">当前套餐</view>
            </view>

            <view class="subscription__price">
              <text class="subscription__price-symbol">¥</text>
              <text class="subscription__price-number">{{ priceInteger(plan.price) }}</text>
              <text class="subscription__price-unit">/年</text>
            </view>
            <text class="subscription__price-note">约 {{ money(Math.round(plan.price / 12)) }}/月，开通后即可使用</text>

            <view class="subscription__feature-list">
              <view v-for="feature in planFeature(plan)" :key="feature" class="subscription__feature">
                <JzIcon name="check-circle" :size="28" color="#16A394" :stroke-width="2.2" />
                <text>{{ feature }}</text>
              </view>
            </view>

            <view class="subscription__plan-modules">
              <JzTag v-for="module in plan.modules.slice(0, 4)" :key="module" :text="moduleText(module)" />
              <JzTag v-if="plan.modules.length > 4" :text="`+${plan.modules.length - 4} 模块`" color="#778390" />
            </view>
            <view class="subscription__select-state">
              <JzIcon :name="selectedPlanCode === plan.code ? 'check-circle' : 'plus-square'" :size="30" :color="selectedPlanCode === plan.code ? '#16A394' : '#778390'" />
              <text>{{ selectedPlanCode === plan.code ? '已选择此方案' : '选择此方案' }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view v-if="seatAddon || storeAddon" class="subscription__addons jz-card">
        <view class="subscription__section-head">
          <view>
            <text class="subscription__section-title">弹性加购</text>
            <text class="subscription__section-subtitle">随本次订单生效，续费时可按需再次选择</text>
          </view>
        </view>
        <view v-if="seatAddon" class="subscription__addon-row">
          <view class="subscription__addon-icon"><JzIcon name="users" :size="34" color="#16A394" /></view>
          <view class="jz-grow">
            <text class="subscription__addon-name">{{ seatAddon.name }}</text>
            <text class="subscription__addon-desc">{{ money(seatAddon.unitPrice) }} / 个 / 年</text>
          </view>
          <view class="subscription__stepper">
            <view class="subscription__stepper-btn" @tap="changeQuantity('seats', -1)"><JzIcon name="minus" :size="24" color="#4E5969" /></view>
            <text class="subscription__stepper-value">{{ seatQuantity }}</text>
            <view class="subscription__stepper-btn" @tap="changeQuantity('seats', 1)"><JzIcon name="plus" :size="24" color="#4E5969" /></view>
          </view>
        </view>
        <view v-if="storeAddon" class="subscription__addon-row">
          <view class="subscription__addon-icon subscription__addon-icon--orange"><JzIcon name="building" :size="34" color="#E67E22" /></view>
          <view class="jz-grow">
            <text class="subscription__addon-name">{{ storeAddon.name }}</text>
            <text class="subscription__addon-desc">{{ money(storeAddon.unitPrice) }} / 家 / 年</text>
          </view>
          <view class="subscription__stepper">
            <view class="subscription__stepper-btn" @tap="changeQuantity('stores', -1)"><JzIcon name="minus" :size="24" color="#4E5969" /></view>
            <text class="subscription__stepper-value">{{ storeQuantity }}</text>
            <view class="subscription__stepper-btn" @tap="changeQuantity('stores', 1)"><JzIcon name="plus" :size="24" color="#4E5969" /></view>
          </view>
        </view>
      </view>

      <view class="subscription__checkout jz-card">
        <view class="subscription__checkout-main">
          <text class="subscription__checkout-label">本次订单</text>
          <text class="subscription__checkout-plan">{{ selectedPlan?.name || '请选择套餐' }}</text>
          <text class="subscription__checkout-items">
            {{ selectedPlan ? `${selectedPlan.days} 天有效期` : '选择套餐后查看应付金额' }}
            <template v-if="seatQuantity"> · 席位 +{{ seatQuantity }}</template>
            <template v-if="storeQuantity"> · 门店 +{{ storeQuantity }}</template>
          </text>
        </view>
        <view class="subscription__checkout-price">
          <text class="subscription__checkout-amount">{{ money(orderAmount) }}</text>
          <text class="subscription__checkout-caption">微信安全支付</text>
        </view>
        <button class="jz-btn jz-btn--primary subscription__pay-btn" :disabled="!selectedPlan || paying" @tap="submitOrder">
          {{ paying ? '支付处理中...' : (info.expired || !info.writable ? '立即续费并恢复' : '微信支付') }}
        </button>
        <text class="subscription__agreement">支付即表示同意《订阅服务协议》，到期前续费将顺延有效期。</text>
      </view>

      <view class="subscription__orders jz-card">
        <view class="subscription__section-head">
          <view>
            <text class="subscription__section-title">订单与续费记录</text>
            <text class="subscription__section-subtitle">支付到账后自动开通，历史订单可追溯</text>
          </view>
        </view>
        <view class="subscription__order-filter">
          <text :class="{ 'subscription__order-filter--on': orderFilter === 'all' }" @tap="orderFilter = 'all'">全部</text>
          <text :class="{ 'subscription__order-filter--on': orderFilter === 'pending' }" @tap="orderFilter = 'pending'">待支付</text>
          <text :class="{ 'subscription__order-filter--on': orderFilter === 'granted' }" @tap="orderFilter = 'granted'">已开通</text>
        </view>

        <view v-if="filteredOrders.length" class="subscription__order-list">
          <view v-for="order in filteredOrders" :key="order.orderNo" class="subscription__order">
            <view class="subscription__order-top">
              <view>
                <text class="subscription__order-name">{{ order.planName || '订阅套餐' }}</text>
                <text class="subscription__order-no">{{ order.orderNo }}</text>
              </view>
              <JzTag :text="orderStatusMeta(order.status).text" :color="orderStatusMeta(order.status).color" />
            </view>
            <view class="subscription__order-summary">
              <text>{{ orderItemsText(order) }}</text>
              <text>{{ order.days }} 天有效期</text>
            </view>
            <view class="subscription__order-foot">
              <view>
                <text class="subscription__order-amount">{{ money(order.amount) }}</text>
                <text class="subscription__order-time">
                  {{ order.paidTime ? `支付于 ${formatTime(order.paidTime)}` : `创建于 ${formatTime(order.createdAt)}` }}
                </text>
              </view>
              <view v-if="order.status === 'pending'" class="subscription__order-actions">
                <button class="jz-btn jz-btn--text subscription__order-query" :loading="queryingOrderNo === order.orderNo" @tap="queryPayment(order)">查询结果</button>
                <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="continuePay(order)">继续支付</button>
              </view>
            </view>
          </view>
        </view>
        <JzEmpty v-else text="暂无符合条件的订单" />
      </view>
    </view>

    <view v-else-if="!loading" class="subscription__empty jz-card">
      <JzEmpty text="暂无订阅信息" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.subscription { min-height: 100vh; padding-bottom: 60rpx; background: $jzb-bg-page; }
.subscription__content { padding: 24rpx $jzb-page-pad 0; }
/* 价格行：hero 内突出年费 */
.subscription__price { display: flex; align-items: baseline; gap: 8rpx; margin-top: 16rpx; }
.subscription__price-value { font-size: 40rpx; font-weight: 750; }
.subscription__price-unit { color: rgba(255, 255, 255, .78); font-size: $jzb-font-xs; }
/* 服务周期独立卡片 */
.subscription__period { margin-top: 0; padding: 8rpx 24rpx; }
.subscription__period-row { display: flex; align-items: center; justify-content: space-between; min-height: 88rpx; }
.subscription__period-row + .subscription__period-row { border-top: 1rpx solid $jzb-border-light; }
.subscription__period-label { color: $jzb-text-3; font-size: $jzb-font-sm; }
.subscription__period-value { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 600; }
/* 门店只读区 */
.subscription__stores { margin-top: 0; padding: 24rpx; }
.subscription__store { display: flex; align-items: center; gap: 16rpx; padding: 16rpx 0; }
.subscription__store-info { flex: 1; min-width: 0; }
.subscription__store-name { display: block; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.subscription__store-addr { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.subscription__store-empty { padding: 24rpx 0; color: $jzb-text-3; font-size: $jzb-font-sm; text-align: center; }
.subscription__store-tip { display: block; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $jzb-border-light; color: $jzb-text-4; font-size: $jzb-font-xs; line-height: 1.6; }
.subscription__hero {
  position: relative;
  padding: 34rpx;
  overflow: hidden;
  color: #fff;
  /* 头部已是深绿渐变，卡片改用更亮的中绿，配合上方 24rpx 间距形成层次，避免两块深绿相接 */
  background: linear-gradient(135deg, #12A08F 0%, #2BC4B4 58%, #6FD3C6 100%);
  border-radius: $jzb-radius-xl;
  box-shadow: 0 16rpx 36rpx rgba(14, 138, 125, .16);
}
.subscription__hero-glow {
  position: absolute;
  top: -120rpx;
  right: -80rpx;
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 255, 255, .12);
  border-radius: 50%;
}
.subscription__hero-top { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 24rpx; }
.subscription__hero-copy { flex: 1; min-width: 0; }
.subscription__eyebrow { display: flex; align-items: center; gap: 12rpx; }
.subscription__trial { padding: 4rpx 12rpx; color: #7A4100; background: #FFE8B3; border-radius: $jzb-radius-pill; font-size: 20rpx; font-weight: 700; }
.subscription__plan { display: block; margin-top: 22rpx; font-size: 44rpx; font-weight: 750; line-height: 1.2; }
.subscription__renewal-tip { display: block; margin-top: 14rpx; color: rgba(255,255,255,.82); font-size: $jzb-font-sm; line-height: 1.55; }
.subscription__days-card { width: 150rpx; padding: 20rpx 10rpx; text-align: center; background: rgba(255,255,255,.14); border: 1rpx solid rgba(255,255,255,.18); border-radius: $jzb-radius-lg; backdrop-filter: blur(12px); }
.subscription__days { display: block; font-size: 56rpx; font-weight: 760; line-height: 1; }
.subscription__days-unit { display: block; margin-top: 8rpx; color: rgba(255,255,255,.76); font-size: $jzb-font-xs; }
.subscription__timeline { position: relative; display: flex; gap: 40rpx; margin-top: 34rpx; padding-top: 24rpx; border-top: 1rpx solid rgba(255,255,255,.16); }
.subscription__timeline-row { display: flex; flex-direction: column; gap: 6rpx; color: rgba(255,255,255,.72); font-size: $jzb-font-xs; }
.subscription__timeline-row text:last-child { color: #fff; font-size: $jzb-font-sm; font-weight: 600; }
.subscription__expired-tip { position: relative; margin-top: 24rpx; padding: 18rpx 20rpx; color: #7A261F; background: #FFE9E6; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; line-height: 1.6; }
.subscription__benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; margin: 20rpx 0; }
.subscription__benefit { min-width: 0; padding: 22rpx 16rpx; text-align: center; background: #fff; border: 1rpx solid rgba(15,23,42,.05); border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.subscription__benefit-title { display: block; margin-top: 10rpx; color: $jzb-text-1; font-size: $jzb-font-xs; font-weight: 650; }
.subscription__benefit-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.4; }
.subscription__capacity, .subscription__addons, .subscription__checkout, .subscription__orders { padding: 28rpx; margin-bottom: 20rpx; }
.subscription__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.subscription__section-head--outside { margin: 12rpx 4rpx 20rpx; }
.subscription__section-title { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 680; }
.subscription__section-subtitle { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
.subscription__metric { margin-top: 26rpx; }
.subscription__metric-head { display: flex; justify-content: space-between; gap: 16rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.subscription__metric-head text:last-child { color: $jzb-text-3; font-size: $jzb-font-xs; }
.subscription__progress { height: 12rpx; margin-top: 14rpx; overflow: hidden; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.subscription__progress-inner { height: 100%; background: linear-gradient(90deg, #16A394, #65C7B9); border-radius: $jzb-radius-pill; }
.subscription__modules { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid $jzb-border-light; }
.subscription__plans { width: calc(100% + #{$jzb-page-pad}); margin-left: -$jzb-page-pad; white-space: nowrap; }
.subscription__plan-track { display: inline-flex; gap: 20rpx; padding: 4rpx $jzb-page-pad 24rpx; }
.subscription__plan-card {
  position: relative;
  width: 560rpx;
  padding: 30rpx;
  overflow: hidden;
  white-space: normal;
  background: #fff;
  border: 2rpx solid rgba(15,23,42,.06);
  border-radius: $jzb-radius-xl;
  box-shadow: $jzb-shadow-xs;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.subscription__plan-card--recommended { border-color: rgba(230,126,34,.36); background: linear-gradient(180deg, #FFF9EF 0%, #FFFFFF 34%); }
.subscription__plan-card--selected { border-color: $jzb-primary; box-shadow: 0 14rpx 34rpx rgba(22,163,148,.16); transform: translateY(-4rpx); }
.subscription__plan-ribbon { position: absolute; top: 0; right: 0; padding: 8rpx 22rpx; color: #fff; background: linear-gradient(135deg, #E98A2C, #D86618); border-radius: 0 $jzb-radius-xl 0 $jzb-radius-lg; font-size: 22rpx; font-weight: 700; }
.subscription__plan-head { display: flex; justify-content: space-between; gap: 18rpx; padding-right: 70rpx; }
.subscription__plan-name { display: block; color: $jzb-text-1; font-size: 38rpx; font-weight: 740; }
.subscription__plan-tagline { display: block; min-height: 66rpx; margin-top: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.subscription__current-mark { align-self: flex-start; padding: 6rpx 14rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: 20rpx; white-space: nowrap; }
.subscription__price { display: flex; align-items: baseline; margin-top: 24rpx; color: #D86618; }
.subscription__price-symbol { font-size: 28rpx; font-weight: 700; }
.subscription__price-number { font-size: 66rpx; font-weight: 780; letter-spacing: -2rpx; line-height: 1; }
.subscription__price-unit { margin-left: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.subscription__price-note { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 22rpx; }
.subscription__feature-list { min-height: 220rpx; margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid $jzb-border-light; }
.subscription__feature { display: flex; align-items: flex-start; gap: 12rpx; margin-bottom: 16rpx; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.5; }
.subscription__plan-modules { display: flex; flex-wrap: wrap; gap: 10rpx; min-height: 88rpx; margin-top: 18rpx; }
.subscription__select-state { display: flex; align-items: center; justify-content: center; gap: 10rpx; height: 76rpx; margin-top: 22rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; font-weight: 650; }
.subscription__addon-row { display: flex; align-items: center; gap: 18rpx; padding: 24rpx 0; border-top: 1rpx solid $jzb-border-light; }
.subscription__addon-icon { width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; background: $jzb-primary-lighter; border-radius: 22rpx; }
.subscription__addon-icon--orange { background: $jzb-warning-soft; }
.subscription__addon-name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.subscription__addon-desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.subscription__stepper { display: flex; align-items: center; overflow: hidden; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; }
.subscription__stepper-btn { width: 64rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; }
.subscription__stepper-value { width: 52rpx; text-align: center; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.subscription__checkout { display: flex; flex-wrap: wrap; align-items: center; gap: 18rpx; background: linear-gradient(135deg, #FFFFFF, #F3FBF9); border-color: rgba(22,163,148,.14); }
.subscription__checkout-main { flex: 1; min-width: 0; }
.subscription__checkout-label { display: block; color: $jzb-text-3; font-size: 22rpx; }
.subscription__checkout-plan { display: block; margin-top: 6rpx; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.subscription__checkout-items { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.subscription__checkout-price { text-align: right; }
.subscription__checkout-amount { display: block; color: #D86618; font-size: 42rpx; font-weight: 760; }
.subscription__checkout-caption { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
.subscription__pay-btn { width: 100%; margin-top: 8rpx; }
.subscription__agreement { width: 100%; text-align: center; color: $jzb-text-3; font-size: 20rpx; line-height: 1.5; }
.subscription__order-filter { display: flex; gap: 12rpx; margin-top: 24rpx; }
.subscription__order-filter text { padding: 10rpx 22rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; }
.subscription__order-filter .subscription__order-filter--on { color: $jzb-primary-dark; background: $jzb-primary-lighter; font-weight: 650; }
.subscription__order-list { margin-top: 8rpx; }
.subscription__order { padding: 24rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.subscription__order:last-child { border-bottom: none; }
.subscription__order-top, .subscription__order-summary, .subscription__order-foot { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.subscription__order-name { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.subscription__order-no { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 20rpx; }
.subscription__order-summary { margin-top: 18rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.subscription__order-summary text:last-child { flex-shrink: 0; color: $jzb-text-3; }
.subscription__order-foot { margin-top: 18rpx; }
.subscription__order-amount { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 720; }
.subscription__order-time { display: block; margin-top: 4rpx; color: $jzb-text-3; font-size: 20rpx; }
/* 订单操作：降级为文字 + 描边按钮，避免列表内出现多个主色实心 CTA */
.subscription__order-actions { display: flex; align-items: center; gap: 16rpx; flex-shrink: 0; }
.subscription__order-query { padding: 0 8rpx; min-height: 64rpx; color: $jzb-text-3; }
.subscription__empty { margin: 20rpx $jzb-page-pad; padding: 40rpx; }
</style>
