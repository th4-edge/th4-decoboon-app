<script setup lang="ts">
/**
 * 企业信息维护（BOSS）。
 *
 * FIX-041（2026-10-15）：补齐迁移 114「企业对外信息」的 6 个字段录入入口。
 * 历史坑：后端 P0 第 2 批已支持并返回这 6 个字段（company/company/update 仅 BOSS 可写），
 * 但本页与 `updateCompany` 入参类型一直没补，导致业主端「服务方」区块只能显示
 * 「暂不可确认」，企业无处填写——字段存在却不可用。
 *
 * 业务口径（USER-DECISION-20261014-002 §二/§四「给通道，不给号码」）：
 * - 这 6 项是业主的**知情权**事实，不是宣传，平台不代填、不推算、不背书；
 * - 客服电话必须是**企业统一号码**，禁止填员工个人手机号（业主端不露出员工个人号）。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { identityApi } from '@/domains/identity/api'
import type { Company, CompanySetting } from '@/domains/identity/model'
import { session, updateCompanyProfile } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import { BRAND_COLOR_PRESETS, buildBrandTheme, normalizeBrandColor, serializeBrandTheme } from '@/styles/brand-theme'
import { useBrandTheme } from '@/composables/useBrandTheme'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'
import JzIcon from '@/components/JzIcon.vue'

const company = ref<Company | null>(null)
const editing = ref(false)
const saving = ref(false)
const { brandThemeStyle } = useBrandTheme()
/** 在职员工个人手机号：用于拦截「把员工个人号填成企业客服电话」。 */
const employeePhones = ref<string[]>([])
const form = ref({
  title: '', name: '', addr: '',
  serviceArea: '', serviceTel: '', afterSaleTel: '', uscc: '', qualification: '', intro: ''
})
// 品牌与署名：叙事主体归装企（ANS-BIZ-20261010-004 §4）；平台署名默认关闭
const brandPrimary = ref<'Company' | 'Platform'>('Company')
const custodianCredit = ref(false)
const brandColor = ref<string>(TOKEN_COLOR.primaryBase)
const previewTheme = computed(() => buildBrandTheme(brandColor.value))
const previewThemeStyle = computed(() => serializeBrandTheme(previewTheme.value))
const brandColorLabel = computed(() => normalizeBrandColor(brandColor.value) || '请输入 #RRGGBB')
const editable = computed(() => session.role === 'boss')

/**
 * 统一客服电话/售后专线只允许固话、手机号或企业服务号；是否「员工个人号」由员工名单另行拦截。
 *
 * 历史坑（FIX-041 真实浏览器走查发现）：单测/示例与存量数据都带空格分隔（`0551-6558 8899`），
 * 原正则不认空格 → 用户只是「原样保存」也会被误拦。校验前必须先去掉空白字符（含不间断空格）。
 */
const PHONE_PATTERN = /^(0\d{2,3}-?\d{7,8}(-\d{1,5})?|1[3-9]\d{9}|400-?\d{3}-?\d{4}|95\d{3,5})$/
/** 归一化电话号码：去掉所有空白与不间断空格，便于与正则/员工名单比对。 */
function compactPhone(value: string): string {
  return (value || '').replace(/[\s\u00A0]/g, '')
}
/** GB 32100 统一社会信用代码字符集（18 位，去除易混字符 I O S V Z）。 */
const USCC_PATTERN = /^[0-9A-HJ-NPQRTUWXY]{18}$/

onLoad(async () => {
  try {
    const loaded = await identityApi.companyInfo()
    if (!loaded) throw new Error('企业信息不存在')
    company.value = loaded
    hydrate(loaded)
  } catch (error) { toastError(error, '企业信息加载失败') }
})

function hydrate(loaded: Company) {
  const setting = (loaded.setting || {}) as CompanySetting
  form.value = {
    title: loaded.name,
    name: loaded.shortName || '',
    addr: loaded.city || '',
    serviceArea: setting.serviceArea || '',
    serviceTel: setting.serviceTel || '',
    afterSaleTel: setting.afterSaleTel || '',
    uscc: setting.uscc || '',
    qualification: setting.qualification || '',
    intro: setting.intro || ''
  }
  brandPrimary.value = setting.brandPrimary === 'Platform' ? 'Platform' : 'Company'
  custodianCredit.value = setting.custodianCredit === true
  brandColor.value = normalizeBrandColor(loaded.color) || TOKEN_COLOR.primaryBase
}

function isPresetSelected(value: string): boolean {
  return normalizeBrandColor(brandColor.value) === normalizeBrandColor(value)
}

function onCreditChange(event: Event) {
  const detail = (event as unknown as { detail?: { value?: boolean } }).detail
  custodianCredit.value = detail?.value === true
}

/** 进入编辑时拉一次在职员工手机号（BOSS 才有 company/member/page 权限）。 */
async function loadEmployeePhones() {
  if (employeePhones.value.length) return
  try {
    const page = await identityApi.memberPage({ status: 'Active', size: 200 })
    employeePhones.value = page.list
      .map((item) => compactPhone(item.phone || '').replace(/-/g, ''))
      .filter(Boolean)
  } catch {
    // 拉不到名单时不阻断编辑：由后端 requireBoss 与服务端口径兜底
    employeePhones.value = []
  }
}

function startEdit() {
  editing.value = true
  void loadEmployeePhones()
}

/** 表单校验：返回错误文案，空串表示通过。 */
function validate(): string {
  const value = form.value
  if (!value.title.trim()) return '请填写企业全称'
  if (value.title.trim().length > 128) return '企业全称最长 128 个字符'
  if (value.name.trim().length > 12) return '企业简称最长 12 个字符'
  if ((value.serviceArea || '').trim().length > 128) return '服务区域最长 128 个字符'
  const serviceTel = (value.serviceTel || '').trim()
  const afterSaleTel = (value.afterSaleTel || '').trim()
  if (serviceTel && !PHONE_PATTERN.test(compactPhone(serviceTel))) return '客服电话请填写固话（0551-6558 8899）或企业服务号'
  if (afterSaleTel && !PHONE_PATTERN.test(compactPhone(afterSaleTel))) return '售后专线请填写固话或企业服务号'
  for (const [label, tel] of [['客服电话', serviceTel], ['售后专线', afterSaleTel]] as const) {
    if (tel && employeePhones.value.includes(compactPhone(tel).replace(/-/g, ''))) {
      return `${label}不能填写员工个人手机号，请填写企业统一号码`
    }
  }
  const uscc = (value.uscc || '').trim().toUpperCase()
  if (uscc && !USCC_PATTERN.test(uscc)) return '统一社会信用代码需为 18 位（数字与大写字母，不含 I O S V Z）'
  if ((value.qualification || '').trim().length > 128) return '资质最长 128 个字符'
  if ((value.intro || '').trim().length > 512) return '一句话简介最长 512 个字符'
  if (!normalizeBrandColor(brandColor.value)) return '品牌色需填写 #RRGGBB 格式，例如 #16A394'
  return ''
}

async function save() {
  if (saving.value) return
  const error = validate()
  if (error) { toast(error); return }
  saving.value = true
  try {
    const value = form.value
    const updated = await identityApi.updateCompany({
      title: value.title.trim(),
      name: value.name.trim(),
      addr: value.addr.trim(),
      color: normalizeBrandColor(brandColor.value) || TOKEN_COLOR.primaryBase,
      setting: {
        brandPrimary: brandPrimary.value,
        custodianCredit: custodianCredit.value,
        serviceArea: value.serviceArea.trim(),
        serviceTel: value.serviceTel.trim(),
        afterSaleTel: value.afterSaleTel.trim(),
        uscc: value.uscc.trim().toUpperCase(),
        qualification: value.qualification.trim(),
        intro: value.intro.trim()
      }
    })
    if (!updated) throw new Error('企业信息更新失败')
    company.value = updated
    updateCompanyProfile(updated)
    hydrate(updated)
    editing.value = false
    toast('企业信息已更新', 'success')
  } catch (err) { toastError(err, '企业信息更新失败') } finally { saving.value = false }
}
</script>

<template>
  <view class="ci-page" :style="brandThemeStyle">
    <JzPageHeader title="我的企业" subtitle="企业身份与组织归属" :right-text="editable ? '编辑' : ''" @right="startEdit" />
    <view v-if="company" class="ci-body">
      <view class="jz-card ci-hero">
        <view class="ci-logo"><JzBrandLogo variant="white" :size="54" /></view>
        <text class="ci-name">{{ company.name }}</text>
        <text class="ci-addr">{{ company.city || '未填写企业地址' }}</text>
      </view>

      <!-- 对外服务信息：业主端「服务方」区块的数据来源（迁移 114 / USER-DECISION-20261014-002） -->
      <view class="jz-card ci-service">
        <view class="ci-service__head">
          <text class="ci-service__title">对外服务信息</text>
          <text class="ci-service__hint">业主在「我的家」可见，属于服务主体知情权事实</text>
        </view>
        <template v-if="!editing">
          <view><text>服务区域</text><text>{{ form.serviceArea || '-' }}</text></view>
          <view><text>客服电话</text><text>{{ form.serviceTel || '-' }}</text></view>
          <view><text>售后专线</text><text>{{ form.afterSaleTel || '-' }}</text></view>
          <view><text>统一社会信用代码</text><text>{{ form.uscc || '-' }}</text></view>
          <view><text>资质</text><text>{{ form.qualification || '-' }}</text></view>
          <view><text>一句话简介</text><text>{{ form.intro || '-' }}</text></view>
        </template>
        <template v-else>
          <view><text>服务区域</text><input v-model="form.serviceArea" maxlength="128" placeholder="例：合肥市（蜀山区、滨湖新区）" /></view>
          <view><text>客服电话</text><input v-model="form.serviceTel" maxlength="32" placeholder="企业统一号码，勿填员工个人号" class="jz-numeric-input" /></view>
          <view><text>售后专线</text><input v-model="form.afterSaleTel" maxlength="32" placeholder="企业售后专线，可留空" class="jz-numeric-input" /></view>
          <view><text>统一社会信用代码</text><input v-model="form.uscc" maxlength="18" placeholder="18 位，可留空" /></view>
          <view><text>资质</text><input v-model="form.qualification" maxlength="128" placeholder="例：建筑装饰装修工程专业承包二级" /></view>
          <view class="ci-service__intro"><text>一句话简介</text><textarea v-model="form.intro" maxlength="512" placeholder="一句话说明企业主营与服务承诺" /></view>
          <text class="ci-service__tip">客服电话与售后专线请填写企业统一号码，不要填写员工个人手机号。</text>
        </template>
      </view>

      <view v-if="!editing" class="jz-card ci-info">
        <view><text>企业简称</text><text>{{ company.shortName || '-' }}</text></view>
        <view><text>企业地址</text><text>{{ company.city || '-' }}</text></view>
        <view><text>当前门店</text><text>{{ session.emp?.store?.name || '-' }}</text></view>
        <view><text>当前团队</text><text>{{ session.emp?.team?.name || '-' }}</text></view>
        <view><text>叙事主品牌</text><text>{{ brandPrimary === 'Platform' ? '平台' : '装企（默认）' }}</text></view>
        <view><text>记录存证署名</text><text>{{ custodianCredit ? '显示「记录存证与保管 · 装得清」' : '不显示（默认）' }}</text></view>
        <view class="ci-brand-read">
          <text>品牌色</text>
          <view><view class="ci-brand-read__swatch" :style="{ backgroundColor: previewTheme.primary }" /><text>{{ brandColorLabel }}</text></view>
        </view>
      </view>
      <view v-else class="jz-card ci-info ci-info--form">
        <view><text>企业全称</text><input v-model="form.title" maxlength="128" /></view>
        <view><text>企业简称</text><input v-model="form.name" maxlength="12" /></view>
        <view><text>企业地址</text><input v-model="form.addr" maxlength="256" /></view>
        <view>
          <text>叙事主品牌</text>
          <view class="ci-seg">
            <text :class="{ on: brandPrimary === 'Company' }" @tap="brandPrimary = 'Company'">装企</text>
            <text :class="{ on: brandPrimary === 'Platform' }" @tap="brandPrimary = 'Platform'">平台</text>
          </view>
        </view>
        <view>
          <text>记录存证署名</text>
          <switch :checked="custodianCredit" :color="TOKEN_COLOR.primary" @change="onCreditChange" />
        </view>
      </view>
      <view v-if="editing" class="jz-card ci-brand">
        <view class="ci-brand__head">
          <view>
            <text class="ci-brand__title">品牌外观</text>
            <text class="ci-brand__hint">用于套餐管理、选品与主操作按钮；状态色不随品牌色变化</text>
          </view>
          <text class="ci-brand__reset" @tap="brandColor = TOKEN_COLOR.primaryBase">恢复平台默认</text>
        </view>

        <text class="ci-brand__label">常用颜色</text>
        <view class="ci-brand__presets">
          <view
            v-for="preset in BRAND_COLOR_PRESETS"
            :key="preset.value"
            class="ci-brand__preset"
            :class="{ 'ci-brand__preset--selected': isPresetSelected(preset.value) }"
            @tap="brandColor = preset.value"
          >
            <view class="ci-brand__swatch" :style="{ backgroundColor: preset.value }">
              <JzIcon v-if="isPresetSelected(preset.value)" name="check" :size="24" :color="TOKEN_COLOR.white" />
            </view>
            <text>{{ preset.label }}</text>
          </view>
        </view>

        <view class="ci-brand__custom">
          <text class="ci-brand__label">自定义色值</text>
          <view class="ci-brand__input-wrap">
            <view class="ci-brand__input-swatch" :style="{ backgroundColor: previewTheme.primary }" />
            <input v-model="brandColor" maxlength="7" placeholder="#16A394" />
          </view>
        </view>
        <text class="ci-brand__tip">仅支持 #RRGGBB。颜色过浅时会自动加深主操作色，保证白色文字可读。</text>

        <view class="ci-brand__preview" :style="previewThemeStyle">
          <view class="ci-brand__preview-head">
            <text class="ci-brand__preview-title">效果预览</text>
            <text class="ci-brand__preview-value">{{ brandColorLabel }}</text>
          </view>
          <view class="ci-brand__preview-actions">
            <view class="ci-brand__preview-selected">已选中</view>
            <view class="ci-brand__preview-button">主操作按钮</view>
          </view>
        </view>
      </view>

      <button v-if="editing" class="jz-btn jz-btn--primary jz-btn--block" :disabled="saving" @tap="save">
        {{ saving ? '保存中…' : '保存企业信息' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ci-page { min-height: 100vh; background: $jzb-bg-page; }
.ci-body { padding: 28rpx; }
.ci-hero { padding: 48rpx 32rpx; text-align: center; }
.ci-logo { display: flex; align-items: center; justify-content: center; width: 112rpx; height: 112rpx; margin: 0 auto; background: var(--jzb-brand-gradient, #{$jzb-gradient}); border-radius: 36rpx; }
.ci-name { display: block; margin-top: 22rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.ci-addr { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-service { margin-top: 24rpx; padding: 26rpx 28rpx 10rpx; }
.ci-service__head { margin-bottom: 8rpx; }
.ci-service__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.ci-service__hint { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.ci-service > view { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ci-service > view:last-of-type { border-bottom: none; }
.ci-service text:first-child { flex-shrink: 0; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-service text:last-child { color: $jzb-text-1; text-align: right; }
.ci-service input { flex: 1; margin-left: 24rpx; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.ci-service__intro { align-items: flex-start; flex-direction: column; padding: 22rpx 0; }
.ci-service__intro textarea { width: 100%; height: 160rpx; margin-top: 16rpx; padding: 18rpx 20rpx; box-sizing: border-box; color: $jzb-text-1; font-size: $jzb-font; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; }
.ci-service__tip { display: block; padding: 16rpx 0 20rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.5; }
.ci-info { margin-top: 24rpx; padding: 8rpx 28rpx; }
.ci-info > view { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ci-info > view:last-child { border-bottom: none; }
.ci-info text:first-child { color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-info text:last-child { color: $jzb-text-1; text-align: right; }
.ci-info--form input { flex: 1; margin-left: 24rpx; color: $jzb-text-1; text-align: right; }
.ci-seg { display: flex; gap: 12rpx; }
.ci-seg text { padding: 8rpx 24rpx; border: 1rpx solid $jzb-border-light; border-radius: 999rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ci-seg text.on { border-color: var(--jzb-brand-primary, #{$jzb-primary}); background: var(--jzb-brand-primary-lighter, #{$jzb-primary-lighter}); color: var(--jzb-brand-primary-dark, #{$jzb-primary}); font-weight: 650; }
.ci-brand-read > view { display: flex; align-items: center; gap: 10rpx; }
.ci-brand-read__swatch { width: 28rpx; height: 28rpx; border-radius: 50%; box-shadow: 0 0 0 2rpx $jzb-bg-card, 0 0 0 3rpx $jzb-border-light; }
.ci-brand { margin-top: 24rpx; padding: 28rpx; }
.ci-brand__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.ci-brand__title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 700; }
.ci-brand__hint { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.55; }
.ci-brand__reset { flex: none; padding: 14rpx 0 14rpx 16rpx; color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark}); font-size: $jzb-font-xs; }
.ci-brand__label { display: block; margin-top: 28rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.ci-brand__presets { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18rpx 12rpx; margin-top: 16rpx; }
.ci-brand__preset { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 12rpx 4rpx; border: 1rpx solid transparent; border-radius: $jzb-radius-sm; color: $jzb-text-3; font-size: 20rpx; }
.ci-brand__preset--selected { border-color: var(--jzb-brand-border, rgba(22,163,148,.18)); background: var(--jzb-brand-primary-lightest, #{$jzb-primary-lightest}); color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark}); font-weight: 650; }
.ci-brand__swatch { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: inset 0 0 0 1rpx rgba(15,23,42,.08), 0 4rpx 12rpx rgba(15,23,42,.08); }
.ci-brand__custom { margin-top: 4rpx; }
.ci-brand__input-wrap { display: flex; align-items: center; gap: 16rpx; min-height: 88rpx; margin-top: 12rpx; padding: 0 20rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.ci-brand__input-wrap:focus-within { border-color: var(--jzb-brand-border, rgba(22,163,148,.18)); background: $jzb-bg-card; }
.ci-brand__input-swatch { width: 40rpx; height: 40rpx; flex: none; border-radius: 50%; box-shadow: inset 0 0 0 1rpx rgba(15,23,42,.08); }
.ci-brand__input-wrap input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; font-variant-numeric: tabular-nums; }
.ci-brand__tip { display: block; margin-top: 12rpx; color: $jzb-text-4; font-size: 20rpx; line-height: 1.55; }
.ci-brand__preview { margin-top: 24rpx; padding: 24rpx; border: 1rpx solid var(--jzb-brand-border, rgba(22,163,148,.18)); border-radius: $jzb-radius; background: var(--jzb-brand-gradient-soft, #{$jzb-gradient-soft}); }
.ci-brand__preview-head { display: flex; align-items: center; justify-content: space-between; }
.ci-brand__preview-title { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.ci-brand__preview-value { color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark}); font-size: $jzb-font-xs; font-variant-numeric: tabular-nums; }
.ci-brand__preview-actions { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }
.ci-brand__preview-selected { min-height: 64rpx; padding: 0 24rpx; display: flex; align-items: center; justify-content: center; color: var(--jzb-brand-primary-dark, #{$jzb-primary-dark}); background: var(--jzb-brand-primary-lighter, #{$jzb-primary-lighter}); border: 1rpx solid var(--jzb-brand-border, rgba(22,163,148,.18)); border-radius: $jzb-radius-pill; font-size: $jzb-font-xs; font-weight: 650; }
.ci-brand__preview-button { min-height: 72rpx; flex: 1; display: flex; align-items: center; justify-content: center; color: $jzb-text-inverse; background: var(--jzb-brand-gradient, #{$jzb-gradient}); border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; font-weight: 650; box-shadow: 0 10rpx 24rpx var(--jzb-brand-shadow, rgba(14,138,125,.22)); }
.ci-body > button { margin-top: 28rpx; }
</style>
