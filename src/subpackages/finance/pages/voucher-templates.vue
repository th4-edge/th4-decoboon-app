<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { templateApi, type DocumentTemplateInfo } from '@/domains/document/api'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

type TemplateType = 'Receipt' | 'Payment'

const presets = ref<DocumentTemplateInfo[]>([])
const mine = ref<DocumentTemplateInfo[]>([])
const loading = ref(false)
const loadError = ref('')
const canSave = computed(() => can(session.role, 'edit:doc-template'))
const paymentPresets = computed(() => presets.value.filter((item) => item.type === 'Payment'))
const receiptPresets = computed(() => presets.value.filter((item) => item.type === 'Receipt'))

const typeLabel: Record<string, string> = { Payment: '付款单', Receipt: '收款单' }

onLoad(() => { if (!isLoggedIn()) uni.reLaunch({ url: P.login }) })
onShow(() => { if (isLoggedIn()) void load() })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [presetList, companyList] = await Promise.all([templateApi.presets(), templateApi.templates()])
    presets.value = presetList
    // 只有已落库的企业模板才进入"我的模板"；平台基线副本没有 templateId
    mine.value = companyList.filter((item) => item.templateId && (item.type === 'Receipt' || item.type === 'Payment'))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '凭证模板加载失败'
    toastError(error, '凭证模板加载失败')
  } finally {
    loading.value = false
  }
}

/** 打开平台常用模板：可预览、改名后保存为自己的模板。 */
function openPreset(preset: DocumentTemplateInfo) {
  uni.navigateTo({ url: `${P.financeVoucherTemplate}?preset=${preset.presetCode}` })
}

/** 打开企业模板：编辑已有版本。 */
function openMine(template: DocumentTemplateInfo) {
  uni.navigateTo({ url: `${P.financeVoucherTemplate}?type=${template.type}` })
}

function openBlank() {
  if (!canSave.value) { uni.showToast({ title: '仅企业负责人、店长、财务可维护模板', icon: 'none' }); return }
  uni.navigateTo({ url: `${P.financeVoucherTemplate}?type=Payment` })
}
</script>

<template>
  <view class="fin-page">
    <JzPageHeader title="凭证模板" subtitle="平台内置常用模板；套用后可改并保存为企业模板" :right-text="canSave ? '新建' : ''" :right-icon="canSave ? 'plus' : undefined" @right="openBlank" />

    <view class="fin-body">
      <PageState v-if="loadError && !presets.length" state="error" title="凭证模板加载失败" :subtitle="loadError" @retry="load" />
      <JzSkeleton v-else-if="loading && !presets.length" :rows="4" />

      <view v-else class="vt-guide">
        <view class="vt-guide__icon"><JzIcon name="info" :size="34" :color="TOKEN_COLOR.primary" /></view>
        <view class="jz-grow">
          <text class="vt-guide__title">先套用，再微调</text>
          <text class="vt-guide__sub">平台已内置装企常用凭证；点开任意模板可预览字段与版式，保存后仅对本站企业生效。</text>
        </view>
      </view>

      <view class="vt-section">
        <text class="vt-section__title">付款类常用模板</text>
        <view v-for="preset in paymentPresets" :key="preset.presetCode" class="vt-card" @tap="openPreset(preset)">
          <view class="vt-card__main">
            <text class="vt-card__name">{{ preset.name }}</text>
            <text class="vt-card__note">{{ preset.presetNote }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
      </view>

      <view class="vt-section">
        <text class="vt-section__title">收款类常用模板</text>
        <view v-for="preset in receiptPresets" :key="preset.presetCode" class="vt-card" @tap="openPreset(preset)">
          <view class="vt-card__main">
            <text class="vt-card__name">{{ preset.name }}</text>
            <text class="vt-card__note">{{ preset.presetNote }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
      </view>

      <view class="vt-section">
        <text class="vt-section__title">我的模板</text>
        <view v-for="template in mine" :key="template.type" class="vt-card" @tap="openMine(template)">
          <view class="vt-card__main">
            <text class="vt-card__name">{{ template.name }}</text>
            <text class="vt-card__note">{{ typeLabel[template.type] || template.type }} · 企业版本 V{{ template.version }}</text>
          </view>
          <JzIcon name="chevron-right" :size="28" :color="TOKEN_COLOR.text4" />
        </view>
        <JzEmpty v-if="!mine.length" text="还没有企业模板" sub="从上面的常用模板点开，改名保存即成为本企业模板" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import '@/styles/finance.scss';

.vt-guide {
  display: flex; align-items: flex-start; gap: 16rpx; margin: 20rpx 0 8rpx;
  padding: 24rpx; background: $jzb-primary-lighter; border-radius: $jzb-radius;
}
.vt-guide__icon { flex: none; }
.vt-guide__title { display: block; color: $jzb-primary-deep; font-size: $jzb-font-sm; font-weight: 650; }
.vt-guide__sub { display: block; margin-top: 6rpx; color: $jzb-text-2; font-size: $jzb-font-xs; line-height: 1.6; }
.vt-section { margin-top: 28rpx; }
.vt-section__title { display: block; margin-bottom: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.vt-card {
  display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx; padding: 26rpx 28rpx;
  background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs;
}
.vt-card__main { flex: 1; min-width: 0; }
.vt-card__name { display: block; color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 600; }
.vt-card__note { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.5; }
</style>
