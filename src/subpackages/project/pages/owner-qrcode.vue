<script setup lang="ts">
/**
 * 业主项目码（一项目一码）。
 *
 * 口径（`USER-DECISION-20261015-001`）：合同生效立项后，项目即可生成专属小程序码；
 * 业主用微信扫码 → 授权手机号 → 服务端比对「授权手机号 == 房屋所属客户档案手机号」→ 进入「我的家」。
 *
 * 交互要点：
 * - 码内只含**项目编号**（scene），不含任何客户信息，可打印贴现场；
 * - 图片是私有存储的短期签名地址，过期后点「刷新」重新签发（不会重复调用微信接口）；
 * - 长按/「保存到相册」用于交付与打印；失败时给出可恢复路径，不用静默兜底。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { projectApi } from '@/domains/project/api'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import { TOKEN_COLOR } from '@/styles/tokens'

interface OwnerQrcode {
  projectId: string
  no: string
  name: string
  ownerQrcodeScene: string
  ownerQrcodeUrl: string
  ownerQrcodeEnvVersion: string
}

const projectId = ref('')
const projectName = ref('')
const qrcode = ref<OwnerQrcode | null>(null)
const loadingState = ref(true)
const loadError = ref('')
const saving = ref(false)

/** 体验版/开发版码的显式提示：正式版发布前扫码只能被体验成员打开。 */
const envHint = computed(() => {
  const env = qrcode.value?.ownerQrcodeEnvVersion
  if (!env || env === 'release') return ''
  return env === 'trial'
    ? '当前生成的是体验版二维码：仅小程序体验成员可扫码打开（正式版发布后自动切换为正式版码）。'
    : '当前生成的是开发版二维码：仅开发者工具/开发者可打开。'
})

onLoad((query) => {
  projectId.value = query?.id || ''
  if (!projectId.value) {
    loadError.value = '缺少项目信息'
    loadingState.value = false
    return
  }
  void load()
})

async function load() {
  loadingState.value = true
  loadError.value = ''
  try {
    const [project, qr] = await Promise.all([
      projectApi.info(projectId.value),
      projectApi.ownerQrcode(projectId.value)
    ])
    projectName.value = project?.name || qr.name || ''
    qrcode.value = qr
  } catch (error) {
    loadError.value = '业主项目码暂不可确认，请稍后重试'
    toastError(error, loadError.value)
  } finally {
    loadingState.value = false
  }
}

function refresh() {
  void load()
}

/** 保存到相册：先下载私有签名地址，再写入相册；失败给出明确原因。 */
async function saveToAlbum() {
  const url = qrcode.value?.ownerQrcodeUrl
  if (!url || saving.value) return
  saving.value = true
  loading('正在保存…')
  try {
    const filePath = await new Promise<string>((resolve, reject) => {
      uni.downloadFile({
        url,
        success: (res) => res.statusCode === 200 ? resolve(res.tempFilePath) : reject(new Error(`下载失败（${res.statusCode}）`)),
        fail: () => reject(new Error('下载失败'))
      })
    })
    await new Promise<void>((resolve, reject) => {
      uni.saveImageToPhotosAlbum({
        filePath,
        success: () => resolve(),
        fail: () => reject(new Error('需要相册权限才能保存，请在设置中开启'))
      })
    })
    hideLoading()
    toast('已保存到相册，可打印或发给业主', 'success')
  } catch (error) {
    hideLoading()
    toastError(error, '保存失败，可长按图片直接保存')
  } finally {
    saving.value = false
  }
}

function copyGuide() {
  const scene = qrcode.value?.ownerQrcodeScene || qrcode.value?.no || ''
  uni.setClipboardData({
    data: `【装得清】${projectName.value || ''} 业主项目码 ${scene}：请业主用微信扫项目码，授权手机号后即可查看自己家的进度与验收。`,
    success: () => toast('引导语已复制', 'success')
  })
}

function goInvite() {
  uni.navigateTo({ url: `${P.projectInvite}?id=${projectId.value}` })
}
</script>

<template>
  <view class="oq">
    <JzPageHeader title="业主项目码" subtitle="业主微信扫码 → 授权手机号 → 进入「我的家」" back />

    <view class="oq__body">
      <view v-if="loadingState" class="jz-card oq__state">
        <text>正在生成业主项目码…</text>
      </view>

      <view v-else-if="loadError" class="jz-card oq__state">
        <text>{{ loadError }}</text>
        <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="refresh">重试</button>
      </view>

      <template v-else-if="qrcode">
        <view class="jz-card oq__card">
          <text class="oq__project">{{ projectName || qrcode.no }}</text>
          <text class="oq__no">项目编号 {{ qrcode.no }}</text>
          <image
            v-if="qrcode.ownerQrcodeUrl"
            class="oq__image"
            :src="qrcode.ownerQrcodeUrl"
            mode="widthFix"
            show-menu-by-longpress
          />
          <text v-else class="oq__empty">项目码暂不可确认，请点下方「刷新」重试</text>
          <text v-if="envHint" class="oq__env">{{ envHint }}</text>
        </view>

        <view class="jz-card oq__tips">
          <text class="oq__tips-title">给业主的扫码说明</text>
          <view class="oq__tip"><text class="oq__tip-idx">1</text><text>业主用**签合同时预留的手机号**绑定微信扫描此码；</text></view>
          <view class="oq__tip"><text class="oq__tip-idx">2</text><text>点「验证手机号，进入我的家」并同意授权；</text></view>
          <view class="oq__tip"><text class="oq__tip-idx">3</text><text>验证通过即可查看自己家的进度、材料、验收与付款，仅可见本项目。</text></view>
          <text class="oq__tips-note">码内只有项目编号，不含任何客户信息；号码不一致时系统会拒绝并要求联系设计师。</text>
        </view>

        <button class="jz-btn jz-btn--primary jz-btn--block" :disabled="saving" @tap="saveToAlbum">
          <JzIcon name="download" :size="26" :color="TOKEN_COLOR.white" /><text>{{ saving ? '保存中…' : '保存到相册（可打印）' }}</text>
        </button>
        <view class="jz-row oq__actions">
          <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="copyGuide">
            <JzIcon name="copy" :size="24" :color="TOKEN_COLOR.primary" /><text>复制说明</text>
          </button>
          <button class="jz-btn jz-btn--ghost jz-btn--sm" @tap="refresh">
            <JzIcon name="refresh" :size="24" :color="TOKEN_COLOR.primary" /><text>刷新</text>
          </button>
          <button class="jz-btn jz-btn--plain jz-btn--sm" @tap="goInvite">
            <JzIcon name="user-plus" :size="24" :color="TOKEN_COLOR.primary" /><text>改用邀请卡片</text>
          </button>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.oq { min-height: 100vh; background: $jzb-bg-page; }
.oq__body { padding: 28rpx; }
.oq__state { display: flex; flex-direction: column; align-items: center; gap: 20rpx; padding: 60rpx 28rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.oq__card { display: flex; flex-direction: column; align-items: center; padding: 36rpx 28rpx; }
.oq__project { color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 750; }
.oq__no { margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.oq__image { width: 460rpx; margin-top: 28rpx; border-radius: $jzb-radius-sm; background: $jzb-bg-hover; }
.oq__empty { margin-top: 28rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.oq__env { margin-top: 18rpx; color: $jzb-warning; font-size: $jzb-font-sm; line-height: 1.6; text-align: center; }
.oq__tips { margin-top: 20rpx; padding: 26rpx 28rpx; }
.oq__tips-title { display: block; color: $jzb-text-1; font-size: $jzb-font; font-weight: 650; }
.oq__tip { display: flex; align-items: flex-start; margin-top: 16rpx; }
.oq__tip-idx { flex-shrink: 0; width: 40rpx; height: 40rpx; margin-right: 16rpx; border-radius: 50%; color: $jzb-primary-dark; background: $jzb-primary-lighter; font-size: $jzb-font-sm; font-weight: 700; text-align: center; line-height: 40rpx; }
.oq__tip text:last-child { flex: 1; color: $jzb-text-2; font-size: $jzb-font-sm; line-height: 1.6; }
.oq__tips-note { display: block; margin-top: 18rpx; color: $jzb-text-3; font-size: $jzb-font-sm; line-height: 1.6; }
.oq__body > button { margin-top: 28rpx; }
.oq__actions { margin-top: 20rpx; justify-content: center; gap: 16rpx; }
</style>
