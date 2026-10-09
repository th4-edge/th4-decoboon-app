<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { contentApi } from '@/domains/content/api'
import type { ContentAsset, ContentAuthorizationPurpose, ContentAuthorizationSubject } from '@/domains/content/model'
import { chooseMedia } from '@/domains/file/choose-media'
import { toast, toastError } from '@/composables/toast'
import PageState from '@/components/PageState/PageState.vue'
import JzTag from '@/components/JzTag.vue'
import { CONTENT_MEDIA_META, CONTENT_PURPOSE_META } from '@/domains/content/meta'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const assetId = ref('')
const asset = ref<ContentAsset | null>(null)
const loading = ref(true)
const busy = ref(false)
const purpose = ref<ContentAuthorizationPurpose>('internal')
const subjectType = ref<ContentAuthorizationSubject>('company')
const channels = ref('抖音,视频号')
const region = ref('中国大陆')
const validFrom = ref(new Date().toISOString().slice(0, 10))
const validTo = ref(new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10))
const allowModify = ref(true)
const allowAi = ref(false)
const allowAds = ref(false)
const allowSublicense = ref(false)
const evidencePath = ref('')
const evidenceName = ref('')
const remark = ref('')
const isManager = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
const subjectRefId = computed(() => {
  if (subjectType.value === 'company') return session.company?.id || ''
  if (subjectType.value === 'customer') return asset.value?.customer?.id || ''
  return session.emp?.id || ''
})
const canUseCustomer = computed(() => Boolean(asset.value?.customer?.id))

onLoad(async (query) => {
  assetId.value = query?.assetId || ''
  if (!assetId.value) { loading.value = false; return }
  try { asset.value = await contentApi.info(assetId.value) }
  catch (error) { toastError(error, '素材加载失败') }
  finally { loading.value = false }
})

function choosePurpose(value: ContentAuthorizationPurpose) {
  purpose.value = value
  if (value === 'znDqMarketing') {
    allowAi.value = false
    allowAds.value = false
    allowSublicense.value = false
  }
}

function chooseSubject(value: ContentAuthorizationSubject) {
  if (value === 'customer' && !canUseCustomer.value) { toast('该素材没有可授权的客户'); return }
  subjectType.value = value
}

async function chooseEvidence() {
  try {
    const files = await chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'] })
    const file = files[0]
    if (!file || !asset.value?.project?.id) return
    const uploaded = await contentApi.upload(file.url, asset.value.project.id)
    evidencePath.value = uploaded.path
    evidenceName.value = uploaded.name || '授权证据'
  } catch (error) {
    toastError(error, '授权证据上传失败')
  }
}

async function submit() {
  if (busy.value || !asset.value) return
  if (!isManager.value) { toast('仅企业负责人或店长可以配置授权'); return }
  if (!subjectRefId.value) { toast('授权主体信息不完整'); return }
  if (validTo.value < validFrom.value) { toast('失效日期不能早于生效日期'); return }
  busy.value = true
  try {
    await contentApi.authorizationSave({
      assetId: asset.value.id,
      subjectType: subjectType.value,
      subjectRefId: subjectRefId.value,
      purpose: purpose.value,
      channels: channels.value.trim() || undefined,
      region: region.value.trim() || undefined,
      validFrom: validFrom.value,
      validTo: validTo.value,
      allowModify: allowModify.value,
      allowAi: allowAi.value,
      allowAds: allowAds.value,
      allowSublicense: allowSublicense.value,
      evidencePath: evidencePath.value || undefined,
      remark: remark.value.trim() || undefined
    })
    toast('授权已保存', 'success')
    setTimeout(() => uni.navigateBack(), 450)
  } catch (error) {
    toastError(error, '授权保存失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <view class="cau">
    <PageState v-if="loading" state="loading" :rows="5" />
    <template v-else-if="asset">
      <view class="cau__asset jz-card">
        <text class="cau__title">{{ asset.title }}</text>
        <text class="cau__sub">{{ asset.project?.name || '未关联项目' }} · {{ CONTENT_MEDIA_META[asset.mediaType].label }}</text>
      </view>
      <view class="cau__card jz-card">
        <text class="cau__label">授权用途 <text class="cau__required">*</text></text>
        <view class="cau__purposes">
          <button v-for="item in (Object.keys(CONTENT_PURPOSE_META) as ContentAuthorizationPurpose[])" :key="item" class="cau__purpose" :class="{ 'cau__purpose--active': purpose === item }" @tap="choosePurpose(item)">
            <text>{{ CONTENT_PURPOSE_META[item].label }}</text>
            <text>{{ CONTENT_PURPOSE_META[item].description }}</text>
          </button>
        </view>
        <text class="cau__label">授权主体</text>
        <view class="cau__segment">
          <button class="cau__segment-btn" :class="{ 'cau__segment-btn--active': subjectType === 'company' }" @tap="chooseSubject('company')">企业</button>
          <button class="cau__segment-btn" :class="{ 'cau__segment-btn--active': subjectType === 'customer' }" :disabled="!canUseCustomer" @tap="chooseSubject('customer')">客户</button>
          <button class="cau__segment-btn" :class="{ 'cau__segment-btn--active': subjectType === 'employee' }" @tap="chooseSubject('employee')">员工本人</button>
        </view>
        <view class="jz-form-row"><text class="jz-form-label">授权渠道</text><input v-model="channels" class="jz-form-control" placeholder="抖音, 视频号, 小红书" placeholder-style="text-align: left" /></view>
        <view class="jz-form-row"><text class="jz-form-label">授权地域</text><input v-model="region" class="jz-form-control" placeholder="中国大陆" placeholder-style="text-align: left" /></view>
        <view class="cau__dates">
          <view class="cau__date"><text class="cau__label">生效日期</text><JzSelectField mode="date" variant="boxed" :value="validFrom" :display="validFrom" @change="validFrom = $event" /></view>
          <view class="cau__date"><text class="cau__label">失效日期</text><JzSelectField mode="date" variant="boxed" :value="validTo" :display="validTo" :start="validFrom" @change="validTo = $event" /></view>
        </view>
        <view class="cau__checks">
          <label><input v-model="allowModify" type="checkbox" /><text>允许修改</text></label>
          <label><input v-model="allowAi" type="checkbox" /><text>允许AI处理</text></label>
          <label><input v-model="allowAds" type="checkbox" /><text>允许投流</text></label>
          <label><input v-model="allowSublicense" type="checkbox" /><text>允许转授权</text></label>
        </view>
        <text class="cau__label">授权证据</text>
        <view class="cau__evidence" @tap="chooseEvidence"><text>{{ evidenceName || '上传授权书或客户/员工确认证据' }}</text></view>
        <view class="jz-form-row jz-form-row--col"><text class="jz-form-label">备注</text><textarea v-model="remark" class="cau__textarea" maxlength="1000" placeholder="记录授权背景、使用边界和撤回方式" /></view>
      </view>
      <view class="cau__tip jz-card"><JzTag text="装得清宣传默认关闭" :color="TOKEN_COLOR.text3" /><text>公开发布与宣传授权必须分别配置；涉及客户或员工资料时，还需对应主体授权。</text></view>
      <button class="jz-btn jz-btn--primary jz-btn--block cau__submit" :loading="busy" :disabled="!isManager" @tap="submit">保存授权</button>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.cau { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.cau__asset { padding: 24rpx; }
.cau__title { display: block; font-size: $jzb-font-lg; font-weight: 750; }
.cau__sub { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cau__card { margin-top: 18rpx; padding: 28rpx; }
.cau__label { display: block; margin: 24rpx 0 10rpx; color: $jzb-text-2; font-size: $jzb-font-sm; font-weight: 650; }
.cau__required { color: $jzb-danger; }
.cau__purposes { display: grid; gap: 12rpx; }
.cau__purpose { padding: 18rpx 20rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: #fff; text-align: left; }
.cau__purpose text { display: block; }
.cau__purpose text:first-child { color: $jzb-text-1; font-size: $jzb-font-sm; font-weight: 650; }
.cau__purpose text:last-child { margin-top: 6rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cau__purpose--active { border-color: rgba(14,138,125,.22); background: $jzb-primary-lighter; }
.cau__segment { display: flex; gap: 12rpx; }
.cau__segment-btn { flex: 1; min-height: 72rpx; border: 1rpx solid $jzb-border-light; border-radius: $jzb-radius-sm; background: #fff; color: $jzb-text-3; font-size: $jzb-font-xs; }
.cau__segment-btn--active { color: $jzb-primary-dark; border-color: rgba(14,138,125,.2); background: $jzb-primary-lighter; font-weight: 700; }
.cau__input { width: 100%; min-height: 84rpx; padding: 0 20rpx; box-sizing: border-box; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; color: $jzb-text-1; font-size: $jzb-font-sm; }
.cau__dates { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.cau__date .cau__label { margin-top: 0; }
.cau__checks { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-top: 18rpx; }
.cau__checks label { display: flex; align-items: center; gap: 8rpx; color: $jzb-text-2; font-size: $jzb-font-xs; }
.cau__evidence { min-height: 86rpx; padding: 0 20rpx; display: flex; align-items: center; border: 1rpx dashed rgba(14,138,125,.35); border-radius: $jzb-radius-sm; color: $jzb-primary-dark; background: $jzb-primary-lightest; font-size: $jzb-font-xs; }
.cau__textarea { width: 100%; min-height: 180rpx; box-sizing: border-box; padding: 20rpx; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font-sm; }
.cau__tip { margin-top: 18rpx; padding: 22rpx; display: flex; flex-direction: column; gap: 10rpx; color: $jzb-text-3; font-size: $jzb-font-xs; line-height: 1.6; }
.cau__submit { margin-top: 24rpx; }
</style>
