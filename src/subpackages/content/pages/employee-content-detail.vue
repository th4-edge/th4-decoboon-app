<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { employeeContentApi, leadTouchApi } from '@/domains/content/api'
import type { EmployeeContent } from '@/domains/content/model'
import { EMPLOYEE_CONTENT_STATUS_META } from '@/domains/content/meta'
import { confirm, toast, toastError } from '@/composables/toast'
import JzTag from '@/components/JzTag.vue'
import PageState from '@/components/PageState/PageState.vue'

const contentId = ref('')
const content = ref<EmployeeContent | null>(null)
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const postUrl = ref('')
const touchCount = ref(0)
const isManager = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
const canReview = computed(() => Boolean(isManager.value && content.value?.status === 'pendingReview'))
const canBackfill = computed(() => Boolean(content.value && ['readyToPublish', 'published', 'backfilled'].includes(content.value.status)))

onLoad((query) => { contentId.value = query?.contentId || '' })
onShow(() => void load())

async function load() {
  if (!contentId.value) return
  loading.value = true; loadError.value = ''
  try {
    content.value = await employeeContentApi.info(contentId.value)
    postUrl.value = content.value.latestPublication?.postUrl || ''
    try { touchCount.value = (await leadTouchApi.list({ contentId: contentId.value })).length } catch { touchCount.value = 0 }
  }
  catch (error) { content.value = null; loadError.value = error instanceof Error ? error.message : '内容详情暂不可确认'; toastError(error, loadError.value) }
  finally { loading.value = false }
}

async function review(approved: boolean) {
  if (!content.value || busy.value) return
  if (!approved && !await confirm('驳回成片', '驳回后员工可以重新生成。', '确认驳回')) return
  busy.value = true
  try { content.value = await employeeContentApi.review(content.value.id, approved, approved ? undefined : '审核驳回，请修改后重新提交'); toast(approved ? '审核通过' : '已驳回', 'success'); await load() }
  catch (error) { toastError(error, '审核失败') }
  finally { busy.value = false }
}

function downloadError(error: unknown): Error {
  const message = String((error as { errMsg?: unknown } | null)?.errMsg || '')
  const normalized = message.toLowerCase()
  if (normalized.includes('url not in domain list')) return new Error('下载域名未配置，请管理员将当前服务域名加入微信 downloadFile 合法域名')
  if (normalized.includes('devtools') || normalized.includes('not support')) return new Error('当前开发者工具不支持保存到相册，请使用真机测试')
  if (normalized.includes('timeout')) return new Error('视频下载超时，请检查网络后重试')
  if (normalized.includes('auth') || normalized.includes('permission') || normalized.includes('deny')) return new Error('未获得相册权限，请在微信设置中开启后重试')
  return new Error('视频下载失败，请检查网络后重试')
}

async function ensureAlbumPermission(): Promise<boolean> {
  const setting = await new Promise<{ authSetting?: Record<string, any> } | null>((resolve) => {
    uni.getSetting({ success: (result) => resolve(result), fail: () => resolve(null) })
  })
  const status = setting?.authSetting?.['scope.writePhotosAlbum']
  if (status === true) return true
  if (status === false) {
    const open = await confirm('需要相册权限', '请允许装得清保存视频到相册。是否前往微信设置开启？', '去设置')
    if (!open) return false
    await new Promise<void>((resolve) => uni.openSetting({ success: () => resolve(), fail: () => resolve() }))
    const next = await new Promise<{ authSetting?: Record<string, any> } | null>((resolve) => {
      uni.getSetting({ success: (result) => resolve(result), fail: () => resolve(null) })
    })
    return next?.authSetting?.['scope.writePhotosAlbum'] === true
  }
  try {
    await new Promise<void>((resolve, reject) => {
      uni.authorize({ scope: 'scope.writePhotosAlbum', success: () => resolve(), fail: reject })
    })
    return true
  } catch {
    return false
  }
}

async function downloadRenderedVideo(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode !== 200) { reject(new Error(`视频下载失败(${res.statusCode})`)); return }
        resolve(res.tempFilePath)
      },
      fail: (error) => reject(downloadError(error))
    })
  })
}

async function saveToAlbum() {
  if (!content.value?.renderedUrl) { toast('暂无可保存的成片'); return }
  try {
    if (!await ensureAlbumPermission()) { toast('未获得相册权限，无法保存'); return }
    const filePath = await downloadRenderedVideo(content.value.renderedUrl)
    await new Promise<void>((resolve, reject) => {
      uni.saveVideoToPhotosAlbum({
        filePath,
        success: () => resolve(),
        fail: (error) => reject(downloadError(error))
      })
    })
    toast('已保存到相册', 'success')
  } catch (error) { toastError(error, '保存到相册失败') }
}

function copyCaption() {
  if (!content.value?.caption) return
  uni.setClipboardData({ data: content.value.caption, success: () => toast('文案已复制', 'success') })
}

async function backfill() {
  if (!content.value || busy.value) return
  if (!postUrl.value.trim()) { toast('请填写抖音作品链接'); return }
  busy.value = true
  try { await employeeContentApi.backfill({ contentId: content.value.id, platform: 'douyin', postUrl: postUrl.value.trim(), publishedAt: new Date().toISOString() }); toast('发布已回填', 'success'); await load() }
  catch (error) { toastError(error, '回填失败') }
  finally { busy.value = false }
}

function regenerate() { uni.navigateTo({ url: `${P.employeeContentCreate}?contentId=${contentId.value}` }) }
function openLeadTouch() { uni.navigateTo({ url: `${P.contentLeadTouch}?contentId=${contentId.value}` }) }
</script>

<template>
  <view class="ecd">
    <PageState v-if="loading && !content" state="loading" :rows="5" />
    <PageState v-else-if="loadError && !content" state="error" :title="loadError" @retry="load" />
    <template v-else-if="content">
      <view class="ecd__video jz-card">
        <video v-if="content.renderedUrl" :src="content.renderedUrl" controls />
        <view v-else class="ecd__empty">尚未生成成片</view>
      </view>
      <view class="ecd__card jz-card">
        <view class="jz-between"><text class="ecd__title">{{ content.task?.title || '内容任务' }}</text><JzTag :text="EMPLOYEE_CONTENT_STATUS_META[content.status].label" :color="EMPLOYEE_CONTENT_STATUS_META[content.status].color" /></view>
        <text class="ecd__caption">{{ content.caption || '未填写发布文案' }}</text>
        <text v-if="content.rejectionReason" class="ecd__reject">驳回原因：{{ content.rejectionReason }}</text>
        <view class="ecd__actions">
          <button class="jz-btn jz-btn--secondary jz-btn--sm" @tap="copyCaption">复制文案</button>
          <button v-if="content.renderedUrl" class="jz-btn jz-btn--secondary jz-btn--sm" @tap="saveToAlbum">保存到相册</button>
        </view>
      </view>
      <view v-if="canReview" class="ecd__card jz-card">
        <text class="ecd__section">企业审核</text>
        <text class="ecd__sub">确认素材、文案和表达边界后通过审核。</text>
        <view class="ecd__actions"><button class="jz-btn jz-btn--primary jz-btn--sm" :loading="busy" @tap="review(true)">审核通过</button><button class="jz-btn jz-btn--ghost jz-btn--sm" :disabled="busy" @tap="review(false)">驳回</button></view>
      </view>
      <view v-if="content.status === 'rejected'" class="ecd__card jz-card"><text class="ecd__section">需要修改</text><button class="jz-btn jz-btn--primary jz-btn--block" @tap="regenerate">重新生成</button></view>
      <view v-if="content.status === 'backfilled'" class="ecd__card jz-card ecd__lead">
        <text class="ecd__section">内容线索</text>
        <text class="ecd__sub">把咨询客户关联到这条已发布内容，归因会回写到现有客户来源和经营看板。</text>
        <view class="ecd__lead-row"><text>已登记归因</text><text>{{ touchCount }} 条</text></view>
        <button class="jz-btn jz-btn--primary jz-btn--block" @tap="openLeadTouch">登记内容线索</button>
      </view>
      <view v-if="canBackfill" class="ecd__card jz-card">
        <text class="ecd__section">发布回填</text>
        <text class="ecd__sub">在抖音手动发布后，将作品链接粘贴回装得清。</text>
        <input v-model="postUrl" class="ecd__input" placeholder="抖音作品链接" />
        <button class="jz-btn jz-btn--primary jz-btn--block ecd__backfill" :loading="busy" @tap="backfill">确认发布回填</button>
        <text v-if="content.latestPublication" class="ecd__published">已回填：{{ content.latestPublication.postUrl || '已上传截图' }}</text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.ecd { min-height:100vh; padding:24rpx; background:$jzb-bg-page; }
.ecd__video { height:480rpx; overflow:hidden; background:$jzb-primary-lightest; }
.ecd__video video { width:100%; height:100%; }
.ecd__empty { height:100%; display:grid;place-items:center;color:$jzb-text-3; }
.ecd__card { margin-top:18rpx; padding:26rpx; }
.ecd__title { font-size:$jzb-font-lg; font-weight:750; }
.ecd__caption { display:block; margin-top:14rpx; color:$jzb-text-2; font-size:$jzb-font-sm; line-height:1.7; }
.ecd__reject { display:block; margin-top:14rpx; color:$jzb-danger; font-size:$jzb-font-xs; }
.ecd__section { display:block; font-size:$jzb-font; font-weight:700; }
.ecd__sub { display:block; margin-top:8rpx; color:$jzb-text-3; font-size:$jzb-font-xs; line-height:1.6; }
.ecd__actions { display:flex; gap:12rpx; flex-wrap:wrap; margin-top:18rpx; }
.ecd__input { width:100%; min-height:84rpx; box-sizing:border-box; margin-top:16rpx; padding:0 20rpx; background:$jzb-bg-hover; border-radius:$jzb-radius-sm; font-size:$jzb-font-sm; }
.ecd__backfill { margin-top:16rpx; }
.ecd__published { display:block; margin-top:12rpx; color:$jzb-success; font-size:$jzb-font-xs; }
.ecd__lead { background:linear-gradient(145deg,#fff,$jzb-primary-lightest); }
.ecd__lead-row { display:flex; justify-content:space-between; margin:18rpx 0 14rpx; padding:16rpx 0; border-top:1rpx solid $jzb-border-light; border-bottom:1rpx solid $jzb-border-light; color:$jzb-text-3; font-size:$jzb-font-xs; }
.ecd__lead-row text:last-child { color:$jzb-text-1; font-weight:700; }
</style>
