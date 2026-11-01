<script setup lang="ts">
/**
 * 企业信息维护（BOSS）。
 *
 * 企业事实只维护一份：Company 基础身份、品牌资产和对外服务信息。
 * 小程序的影响范围：我的企业、员工邀请、业主首页、业主分享页。
 * 合同/PDF/历史单据必须走后续品牌快照，不能在保存时静默改写历史文件。
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { identityApi } from '@/domains/identity/api'
import type { Company, CompanySetting } from '@/domains/identity/model'
import { session } from '@/domains/identity/session'
import { COMPANY_BRAND_COLORS, DEFAULT_BRAND_COLOR, isValidBrandColor } from '@/domains/identity/brand'
import { applyBrandTheme, deriveBrandTheme } from '@/domains/identity/brandTheme'
import { BRAND_COLOR_PRESETS, normalizeBrandColor } from '@/styles/brand-theme'
import { chooseImages } from '@/domains/file/choose-media'
import { confirm, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'

const company = ref<Company | null>(null)
const editing = ref(false)
const saving = ref(false)
const logoUploading = ref(false)
const employeePhones = ref<string[]>([])
const customColor = ref(DEFAULT_BRAND_COLOR)
const brandColor = ref(TOKEN_COLOR.primaryBase)

const form = ref({
  title: '',
  name: '',
  addr: '',
  logo: '',
  color: '',
  serviceArea: '',
  serviceTel: '',
  afterSaleTel: '',
  uscc: '',
  qualification: '',
  intro: ''
})
const editable = computed(() => session.role === 'boss')

const logoStatus = computed(() => form.value.logo ? '已上传企业Logo' : '使用企业简称首字')
const colorStatus = computed(() => form.value.color ? '已自定义品牌色' : '使用装得清默认品牌色')
const previewTheme = computed(() => deriveBrandTheme(form.value.color))

const PHONE_PATTERN = /^(0\d{2,3}-?\d{7,8}(-\d{1,5})?|1[3-9]\d{9}|400-?\d{3}-?\d{4}|95\d{3,5})$/
const USCC_PATTERN = /^[0-9A-HJ-NPQRTUWXY]{18}$/

function compactPhone(value: string): string {
  return (value || '').replace(/[\s\u00A0]/g, '')
}

onLoad(async () => {
  try {
    const loaded = await identityApi.companyInfo()
    if (!loaded) throw new Error('企业信息不存在')
    company.value = loaded
    hydrate(loaded)
  } catch (error) {
    toastError(error, '企业信息加载失败')
  }
})

function hydrate(loaded: Company) {
  const setting = (loaded.setting || {}) as CompanySetting
  form.value = {
    title: loaded.name,
    name: loaded.shortName || '',
    addr: loaded.city || '',
    logo: loaded.logo || '',
    color: loaded.color || '',
    serviceArea: setting.serviceArea || '',
    serviceTel: setting.serviceTel || '',
    afterSaleTel: setting.afterSaleTel || '',
    uscc: setting.uscc || '',
    qualification: setting.qualification || '',
    intro: setting.intro || ''
  }
  customColor.value = loaded.color || DEFAULT_BRAND_COLOR
  brandColor.value = normalizeBrandColor(loaded.color) || TOKEN_COLOR.primaryBase
}

function syncSession(updated: Company) {
  company.value = updated
  hydrate(updated)
  session.company = updated
  if (session.emp) session.emp.company = updated
  applyBrandTheme(updated.color)
}

async function loadEmployeePhones() {
  if (employeePhones.value.length) return
  try {
    const page = await identityApi.memberPage({ status: 'Active', size: 200 })
    employeePhones.value = page.list
      .map((item) => compactPhone(item.phone || '').replace(/-/g, ''))
      .filter(Boolean)
  } catch {
    employeePhones.value = []
  }
}

function startEdit() {
  hydrate(company.value || ({} as Company))
  editing.value = true
  applyBrandTheme(company.value?.color)
  void loadEmployeePhones()
}

function cancelEdit() {
  if (company.value) hydrate(company.value)
  applyBrandTheme(company.value?.color)
  editing.value = false
}

onUnload(() => applyBrandTheme(company.value?.color))

async function chooseLogo() {
  if (logoUploading.value) return
  try {
    const images = await chooseImages({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'] })
    if (!images.length) return
    logoUploading.value = true
    const updated = await identityApi.uploadCompanyLogo(images[0])
    if (!updated) throw new Error('Logo上传后未返回企业信息')
    syncSession(updated)
    toast('企业Logo已更新', 'success')
  } catch (error) {
    toastError(error, '企业Logo上传失败')
  } finally {
    logoUploading.value = false
  }
}

async function removeLogo() {
  if (!form.value.logo) return
  const ok = await confirm('移除企业Logo', '移除后将使用企业简称首字作为展示占位，是否继续？', '移除')
  if (!ok) return
  try {
    const updated = await identityApi.removeCompanyLogo()
    if (!updated) throw new Error('移除Logo后未返回企业信息')
    syncSession(updated)
    toast('已改为简称首字展示', 'success')
  } catch (error) {
    toastError(error, '移除企业Logo失败')
  }
}

function selectColor(value: string) {
  form.value.color = value
  customColor.value = value || DEFAULT_BRAND_COLOR
  brandColor.value = normalizeBrandColor(value) || TOKEN_COLOR.primaryBase
  applyBrandTheme(value)
}

function applyCustomColor() {
  if (!isValidBrandColor(customColor.value)) {
    toast('请输入正确的颜色值，例如 #5C7C6E')
    return
  }
  form.value.color = customColor.value.trim().toUpperCase()
  brandColor.value = normalizeBrandColor(form.value.color) || TOKEN_COLOR.primaryBase
  applyBrandTheme(form.value.color)
}

function validate(): string {
  const value = form.value
  if (!value.title.trim()) return '请填写企业展示名称'
  if (value.title.trim().length > 128) return '企业展示名称最长 128 个字符'
  if (value.name.trim().length > 12) return '企业简称最长 12 个字符'
  if (value.addr.trim().length > 256) return '企业办公地址最长 256 个字符'
  if (value.serviceArea.trim().length > 128) return '服务区域最长 128 个字符'
  const serviceTel = value.serviceTel.trim()
  const afterSaleTel = value.afterSaleTel.trim()
  if (serviceTel && !PHONE_PATTERN.test(compactPhone(serviceTel))) return '客服电话请填写固话（如 0551-6558 8899）或企业服务号'
  if (afterSaleTel && !PHONE_PATTERN.test(compactPhone(afterSaleTel))) return '售后专线请填写固话或企业服务号'
  for (const [label, tel] of [['客服电话', serviceTel], ['售后专线', afterSaleTel]] as const) {
    if (tel && employeePhones.value.includes(compactPhone(tel).replace(/-/g, ''))) {
      return `${label}不能填写员工个人手机号，请填写企业统一号码`
    }
  }
  const uscc = value.uscc.trim().toUpperCase()
  if (uscc && !USCC_PATTERN.test(uscc)) return '统一社会信用代码需为 18 位，且不含 I、O、S、V、Z'
  if (value.qualification.trim().length > 128) return '施工资质最长 128 个字符'
  if (value.intro.trim().length > 512) return '企业简介最长 512 个字符'
  return ''
}

async function save() {
  if (saving.value) return
  const error = validate()
  if (error) {
    toast(error)
    return
  }
  saving.value = true
  try {
    const value = form.value
    const updated = await identityApi.updateCompany({
      title: value.title.trim(),
      name: value.name.trim(),
      addr: value.addr.trim(),
      color: normalizeBrandColor(brandColor.value) || TOKEN_COLOR.primaryBase,
      setting: {
        serviceArea: value.serviceArea.trim(),
        serviceTel: value.serviceTel.trim(),
        afterSaleTel: value.afterSaleTel.trim(),
        uscc: value.uscc.trim().toUpperCase(),
        qualification: value.qualification.trim(),
        intro: value.intro.trim()
      }
    })
    if (!updated) throw new Error('企业信息更新失败')
    syncSession(updated)
    editing.value = false
    toast('企业信息已更新，App 与 Web 主题已同步', 'success')
  } catch (err) {
    applyBrandTheme(company.value?.color)
    toastError(err, '企业信息更新失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="ci-page">
    <JzPageHeader
      title="企业信息"
      subtitle="品牌展示与业主服务资料"
      :right-text="editable && !editing ? '编辑' : ''"
      @right="startEdit"
    />

    <view v-if="company" class="ci-body">
      <view class="ci-brand-preview" :style="{ background: previewTheme.gradient }">
        <view class="ci-brand-preview__main">
          <CompanyBrandMark
            :name="form.title"
            :short-name="form.name"
            :logo="form.logo"
            :color="form.color"
            :size="112"
            surface="white"
          />
          <view class="ci-brand-preview__copy">
            <text class="ci-brand-preview__eyebrow">企业对外识别</text>
            <text class="ci-brand-preview__name">{{ form.title || '待填写企业名称' }}</text>
            <text class="ci-brand-preview__sub">{{ logoStatus }} · {{ colorStatus }}</text>
          </view>
        </view>
        <view class="ci-brand-preview__impact">
          <JzIcon name="info" :size="26" :color="TOKEN_COLOR.primary" />
          <text>会同步到员工邀请、业主首页和业主分享页；不会改写已生成的历史合同与文件。</text>
        </view>
      </view>

      <view class="ci-section">
        <view class="ci-section__head">
          <text class="ci-section__title">基础身份</text>
          <text class="ci-section__desc">让员工和业主知道“这是哪家企业”</text>
        </view>

        <view v-if="!editing" class="ci-read-card jz-card">
          <view class="ci-read-row"><text>企业展示名称</text><text>{{ form.title || '暂不可确认' }}</text></view>
          <view class="ci-read-row"><text>企业简称</text><text>{{ form.name || '暂未填写' }}</text></view>
          <view class="ci-read-row"><text>企业办公地址</text><text>{{ form.addr || '暂未填写' }}</text></view>
        </view>

        <view v-else class="ci-form-card jz-card">
          <view class="ci-field">
            <text class="ci-field__label">企业展示名称 <text class="ci-field__required">*</text></text>
            <input v-model="form.title" class="ci-field__input" maxlength="128" placeholder="例如：合肥麦鸿装饰" />
            <text class="ci-field__help">用于小程序首页、员工邀请和业主识别。正式合同前仍需补全企业法定全称。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">企业简称</text>
            <input v-model="form.name" class="ci-field__input" maxlength="12" placeholder="例如：麦鸿装饰" />
            <text class="ci-field__help">建议 2–12 个字。未上传 Logo 时，系统会使用简称首字生成企业占位。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">企业办公地址</text>
            <input v-model="form.addr" class="ci-field__input" maxlength="256" placeholder="例如：合肥市蜀山区××路××号" />
            <text class="ci-field__help">填写客户能找到企业的办公或通讯地址，不要填写某个工地的施工地址。</text>
          </view>
        </view>
      </view>

      <view class="ci-section">
        <view class="ci-section__head">
          <text class="ci-section__title">企业品牌</text>
          <text class="ci-section__desc">Logo 和品牌色会用于业主可见页面</text>
        </view>

        <view class="ci-brand-card jz-card">
          <view class="ci-logo-editor">
            <CompanyBrandMark :name="form.title" :short-name="form.name" :logo="form.logo" :color="form.color" :size="120" />
            <view class="ci-logo-editor__copy">
              <text class="ci-logo-editor__title">{{ logoStatus }}</text>
              <text class="ci-logo-editor__desc">建议上传正方形 PNG/JPG，主体清晰；不超过 2MB。未上传时显示企业简称首字。</text>
              <view v-if="editing" class="ci-logo-editor__actions">
                <button class="jz-btn jz-btn--plain jz-btn--sm" :loading="logoUploading" @tap="chooseLogo">
                  {{ form.logo ? '更换Logo' : '上传Logo' }}
                </button>
                <text v-if="form.logo" class="ci-text-action" @tap="removeLogo">移除</text>
              </view>
            </view>
          </view>

          <view class="ci-divider" />
          <view class="ci-color-head">
            <view>
              <text class="ci-color-head__title">品牌色</text>
              <text class="ci-color-head__desc">企业品牌色会生成 App、小程序与 Web 的主题色阶；成功、警告、危险等业务状态色保持不变。</text>
            </view>
            <text class="ci-color-head__current">{{ colorStatus }}</text>
          </view>
          <view v-if="editing" class="ci-brand-quick">
            <text class="ci-brand-quick__label">快捷选择</text>
            <view class="ci-brand-quick__list">
              <view
                v-for="preset in BRAND_COLOR_PRESETS"
                :key="preset.value"
                class="ci-brand-quick__item"
                :class="{ 'ci-brand-quick__item--on': normalizeBrandColor(form.color) === normalizeBrandColor(preset.value) }"
                @tap="selectColor(preset.value)"
              >
                <view class="ci-brand-quick__swatch" :style="{ backgroundColor: preset.value }" />
                <text>{{ preset.label }}</text>
              </view>
            </view>
          </view>
          <view class="ci-color-list">
            <view
              v-for="item in COMPANY_BRAND_COLORS"
              :key="item.label"
              class="ci-color-item"
              :class="{ 'ci-color-item--on': form.color === item.value, 'ci-color-item--disabled': !editing }"
              @tap="editing && selectColor(item.value)"
            >
              <view class="ci-color-item__swatch" :class="{ 'ci-color-item__swatch--default': !item.value }">
                <view v-if="item.value" class="ci-color-item__dot" :style="{ backgroundColor: item.value }" />
                <JzIcon v-else name="star" :size="28" :color="TOKEN_COLOR.primary" />
                <JzIcon v-if="form.color === item.value" name="check" :size="24" :color="item.value ? TOKEN_COLOR.white : TOKEN_COLOR.primary" />
              </view>
              <view class="ci-color-item__copy">
                <text class="ci-color-item__label">{{ item.label }}</text>
                <text class="ci-color-item__desc">{{ item.description }}</text>
              </view>
            </view>
          </view>
          <view v-if="editing" class="ci-custom-color">
            <view class="ci-custom-color__swatch" :style="{ backgroundColor: previewTheme.primaryBase }" />
            <view class="ci-custom-color__field">
              <text class="ci-custom-color__label">自定义品牌色</text>
              <input v-model="customColor" maxlength="7" placeholder="#5C7C6E" />
            </view>
            <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="applyCustomColor">应用</button>
          </view>
          <text v-if="editing" class="ci-color-help">支持输入 #RGB 或 #RRGGBB。系统会自动计算浅色、深色、悬停、选中和对比文字颜色。</text>
          <view class="ci-theme-preview">
            <view class="ci-theme-preview__head">
              <text>主题预览</text>
              <text>{{ previewTheme.primaryBase }}</text>
            </view>
            <view class="ci-theme-preview__body">
              <view class="ci-theme-preview__tabs">
                <text class="ci-theme-preview__tab ci-theme-preview__tab--active" :style="{ color: previewTheme.primaryDark, backgroundColor: previewTheme.primaryLighter }">工作台</text>
                <text class="ci-theme-preview__tab">客户</text>
                <text class="ci-theme-preview__tab">项目</text>
              </view>
              <view class="ci-theme-preview__action" :style="{ background: previewTheme.gradient, color: previewTheme.onPrimary }">主要操作</view>
              <view class="ci-theme-preview__colors">
                <view :style="{ backgroundColor: previewTheme.primaryLightest }" />
                <view :style="{ backgroundColor: previewTheme.primaryLighter }" />
                <view :style="{ backgroundColor: previewTheme.primaryBase }" />
                <view :style="{ backgroundColor: previewTheme.primaryDark }" />
                <view :style="{ backgroundColor: previewTheme.ink }" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="ci-section">
        <view class="ci-section__head">
          <text class="ci-section__title">对外服务信息</text>
          <text class="ci-section__desc">业主在“我的家”可见，用于确认服务主体和联系通道</text>
        </view>

        <view v-if="!editing" class="ci-read-card jz-card">
          <view class="ci-read-row"><text>服务区域</text><text>{{ form.serviceArea || '暂未填写' }}</text></view>
          <view class="ci-read-row"><text>企业客服电话</text><text>{{ form.serviceTel || '暂未填写' }}</text></view>
          <view class="ci-read-row"><text>售后专线</text><text>{{ form.afterSaleTel || '暂未填写' }}</text></view>
          <view class="ci-read-row"><text>统一社会信用代码</text><text>{{ form.uscc || '暂未填写' }}</text></view>
          <view class="ci-read-row"><text>施工资质</text><text>{{ form.qualification || '暂未填写' }}</text></view>
          <view class="ci-read-row ci-read-row--block"><text>企业简介</text><text>{{ form.intro || '暂未填写' }}</text></view>
        </view>

        <view v-else class="ci-form-card jz-card">
          <view class="ci-inline-notice">
            <JzIcon name="shield-check" :size="28" :color="TOKEN_COLOR.primary" />
            <text>这些信息会直接展示给业主，属于服务主体知情事实。请由企业负责人填写并审核。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">服务区域</text>
            <textarea v-model="form.serviceArea" class="ci-field__textarea ci-field__textarea--short" maxlength="128" auto-height placeholder="例如：合肥市蜀山区、包河区、滨湖新区" />
            <text class="ci-field__help">填写实际承接业务的城市和区域，不要只写“全国”或“本地”。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">企业客服电话</text>
            <input v-model="form.serviceTel" class="ci-field__input" type="tel" maxlength="32" placeholder="例如：0551-6558 8899" />
            <text class="ci-field__help">填写企业统一客服固话或服务号，不能填写员工个人手机号。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">售后专线</text>
            <input v-model="form.afterSaleTel" class="ci-field__input" type="tel" maxlength="32" placeholder="没有独立售后电话可留空" />
            <text class="ci-field__help">用于业主入住后的维修、质保和售后联系。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">统一社会信用代码</text>
            <input v-model="form.uscc" class="ci-field__input ci-field__input--mono" maxlength="18" placeholder="营业执照上的 18 位代码，可留空" />
            <text class="ci-field__help">从营业执照复制，共 18 位，不含 I、O、S、V、Z。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">施工资质</text>
            <textarea v-model="form.qualification" class="ci-field__textarea ci-field__textarea--short" maxlength="128" auto-height placeholder="例如：建筑装修装饰工程专业承包二级" />
            <text class="ci-field__help">填写证书上的资质名称；没有可留空，平台不会代为填写或背书。</text>
          </view>
          <view class="ci-field">
            <text class="ci-field__label">企业简介</text>
            <textarea v-model="form.intro" class="ci-field__textarea" maxlength="512" placeholder="例如：专注合肥住宅设计与施工，提供透明报价、节点验收和售后保障。" />
            <text class="ci-field__help">用 1–3 句话说明企业主营、服务特点和真实承诺，不要填写无法证明的数据。</text>
          </view>
        </view>
      </view>

      <view v-if="editing" class="ci-save-bar">
        <button class="jz-btn jz-btn--neutral" @tap="cancelEdit">取消</button>
        <button class="jz-btn jz-btn--primary" :loading="saving" @tap="save">保存企业信息</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ci-page { min-height: 100vh; background: $jzb-bg-page; }
.ci-page text, .ci-page input, .ci-page textarea { font-weight: 400; }
.ci-page :deep(.jz-header__title) { font-weight: 600; }
.ci-page :deep(.jz-header__subtitle) { font-weight: 400; }
.ci-body { padding: 24rpx 28rpx calc(48rpx + $jzb-safe-bottom); }
.ci-brand-preview { padding: 30rpx; color: $jzb-text-inverse; background: $jzb-gradient; border-radius: $jzb-radius-lg; box-shadow: 0 18rpx 44rpx var(--jzb-primary-a18, rgba(14, 138, 125, .18)); }
.ci-brand-preview__main { display: flex; align-items: center; gap: 24rpx; }
.ci-brand-preview__copy { min-width: 0; flex: 1; }
.ci-brand-preview__eyebrow { display: block; color: rgba(255,255,255,.66); font-size: 20rpx; letter-spacing: 2rpx; }
.ci-brand-preview__name { display: block; margin-top: 8rpx; overflow: hidden; color: $jzb-text-inverse; font-size: 32rpx; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.ci-brand-preview__sub { display: block; margin-top: 10rpx; color: rgba(255,255,255,.72); font-size: 22rpx; line-height: 1.55; }
.ci-brand-preview__impact { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid rgba(255,255,255,.16); color: rgba(255,255,255,.76); font-size: 21rpx; line-height: 1.65; }
.ci-section { margin-top: 34rpx; }
.ci-section__head { margin: 0 4rpx 16rpx; }
.ci-section__title { display: block; color: $jzb-text-1; font-size: 30rpx; font-weight: 500; }
.ci-section__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.ci-read-card { overflow: hidden; padding: 4rpx 28rpx; }
.ci-read-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 30rpx; padding: 24rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.ci-read-row:last-child { border-bottom: none; }
.ci-read-row > text:first-child { flex: none; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-read-row > text:last-child { min-width: 0; color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 400; text-align: right; line-height: 1.65; word-break: break-word; }
.ci-read-row--block { display: block; }
.ci-read-row--block > text:last-child { display: block; margin-top: 12rpx; text-align: left; }
.ci-form-card { padding: 8rpx 28rpx; }
.ci-field { padding: 24rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.ci-field:last-child { border-bottom: none; }
.ci-field__label { display: block; color: $jzb-text-1; font-size: 25rpx; font-weight: 500; }
.ci-field__required { color: $jzb-danger; }
.ci-field__input, .ci-field__textarea { width: 100%; margin-top: 14rpx; padding: 20rpx 22rpx; box-sizing: border-box; color: $jzb-text-1; background: $jzb-bg-hover; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; line-height: 1.6; }
.ci-field__input { min-height: 84rpx; }
.ci-field__textarea { min-height: 150rpx; }
.ci-field__textarea--short { min-height: 88rpx; }
.ci-field__input--mono { font-family: Menlo, Consolas, monospace; letter-spacing: 1rpx; }
.ci-field__help { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.65; }
.ci-brand-card { padding: 28rpx; }
.ci-logo-editor { display: flex; align-items: flex-start; gap: 24rpx; }
.ci-logo-editor__copy { min-width: 0; flex: 1; }
.ci-logo-editor__title { display: block; color: $jzb-text-1; font-size: 27rpx; font-weight: 500; }
.ci-logo-editor__desc { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.65; }
.ci-logo-editor__actions { display: flex; align-items: center; gap: 22rpx; margin-top: 18rpx; }
.ci-text-action { color: $jzb-danger; font-size: $jzb-font-xs; }
.ci-divider { height: 1rpx; margin: 28rpx 0 24rpx; background: $jzb-border-light; }
.ci-color-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24rpx; }
.ci-color-head__title { display: block; color: $jzb-text-1; font-size: 28rpx; font-weight: 500; }
.ci-color-head__desc { display: block; margin-top: 6rpx; color: $jzb-text-3; font-size: 21rpx; line-height: 1.6; }
.ci-color-head__current { flex: none; padding: 6rpx 14rpx; color: $jzb-primary-dark; background: $jzb-primary-lightest; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.ci-brand-quick { margin-top: 20rpx; }
.ci-brand-quick__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.ci-brand-quick__list { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 12rpx; }
.ci-brand-quick__item { display: flex; align-items: center; gap: 8rpx; padding: 8rpx 14rpx; color: $jzb-text-2; background: $jzb-bg-hover; border: 1rpx solid transparent; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.ci-brand-quick__item--on { border-color: var(--jzb-primary-a24, rgba(22,163,148,.24)); color: $jzb-primary-dark; background: $jzb-primary-lightest; }
.ci-brand-quick__swatch { width: 24rpx; height: 24rpx; border-radius: 50%; box-shadow: inset 0 0 0 1rpx rgba(15,23,42,.08); }
.ci-color-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; margin-top: 20rpx; }
.ci-color-item { display: flex; align-items: flex-start; gap: 12rpx; min-height: 92rpx; padding: 14rpx; box-sizing: border-box; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.ci-color-item--on { border-color: $jzb-primary; background: $jzb-primary-lightest; }
.ci-color-item--disabled { opacity: .78; }
.ci-color-item__swatch { width: 40rpx; height: 40rpx; flex: none; display: flex; align-items: center; justify-content: center; margin-top: 2rpx; border-radius: 12rpx; background: $jzb-bg-card; box-shadow: inset 0 0 0 1rpx rgba(15,23,42,.08); }
.ci-color-item__swatch--default { background: $jzb-primary-lighter; box-shadow: none; }
.ci-color-item__dot { width: 100%; height: 100%; border-radius: inherit; }
.ci-color-item__copy { min-width: 0; display: flex; flex-direction: column; gap: 5rpx; }
.ci-color-item__label { color: $jzb-text-2; font-size: 21rpx; font-weight: 600; line-height: 1.35; }
.ci-color-item__desc { color: $jzb-text-3; font-size: 20rpx; line-height: 1.45; }
.ci-custom-color { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; padding: 18rpx; background: $jzb-bg-hover; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; }
.ci-custom-color__swatch { width: 44rpx; height: 44rpx; flex: none; border-radius: 14rpx; box-shadow: inset 0 0 0 1rpx rgba(15,23,42,.08); }
.ci-custom-color__field { min-width: 0; flex: 1; }
.ci-custom-color__label { display: block; color: $jzb-text-3; font-size: 20rpx; }
.ci-custom-color__field input { width: 100%; margin-top: 4rpx; color: $jzb-text-1; font-family: Menlo, Consolas, monospace; font-size: $jzb-font-sm; }
.ci-color-help { display: block; margin-top: 10rpx; color: $jzb-text-3; font-size: 20rpx; line-height: 1.6; }
.ci-theme-preview { margin-top: 22rpx; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-md; }
.ci-theme-preview__head { display: flex; align-items: center; justify-content: space-between; color: $jzb-text-2; font-size: 21rpx; }
.ci-theme-preview__head text:last-child { font-family: Menlo, Consolas, monospace; color: $jzb-text-3; }
.ci-theme-preview__body { margin-top: 14rpx; padding: 18rpx; background: $jzb-bg-card; border-radius: $jzb-radius-sm; }
.ci-theme-preview__tabs { display: flex; gap: 10rpx; }
.ci-theme-preview__tab { padding: 8rpx 16rpx; color: $jzb-text-3; background: $jzb-bg-hover; border-radius: $jzb-radius-pill; font-size: 20rpx; }
.ci-theme-preview__action { margin-top: 16rpx; min-height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: $jzb-radius-sm; font-size: 22rpx; font-weight: 500; }
.ci-theme-preview__colors { display: flex; gap: 8rpx; margin-top: 16rpx; }
.ci-theme-preview__colors view { height: 22rpx; flex: 1; border-radius: 6rpx; }
.ci-inline-notice { display: flex; align-items: flex-start; gap: 12rpx; margin: 20rpx 0 4rpx; padding: 20rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius-sm; font-size: 21rpx; line-height: 1.65; }
.ci-save-bar { display: grid; grid-template-columns: .7fr 1.3fr; gap: 16rpx; margin-top: 32rpx; padding: 20rpx; background: rgba(255,255,255,.96); border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-lg; box-shadow: 0 14rpx 40rpx rgba(15,23,42,.08); }
</style>
