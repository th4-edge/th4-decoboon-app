<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import type { Customer, CustomerSource } from '@/domains/crm/model'
import { crmApi } from '@/domains/crm/api'
import JzIcon from '@/components/JzIcon.vue'
import { toast, toastError, loading, hideLoading } from '@/composables/toast'

const id = ref('')
const name = ref('')
const phone = ref('')
const phoneLocked = ref(false)
const gender = ref<'M' | 'F'>('M')
const genderIdx = ref(0)
const source = ref<CustomerSource>('walkin')
const community = ref('')
const addr = ref('')
const area = ref('')
const budget = ref('')
const remark = ref('')

const GENDERS = ['男', '女']
const SOURCES: { key: CustomerSource; label: string }[] = [
  { key: 'lead', label: '短视频线索' }, { key: 'referral', label: '转介绍' },
  { key: 'walkin', label: '自然到店' }, { key: 'old', label: '老客户' },
  { key: 'video', label: '抖音咨询' }, { key: 'other', label: '其他' }
]
onLoad((q) => {
  if (!isLoggedIn()) uni.reLaunch({ url: P.login })
  id.value = q?.id || ''
  if (id.value) { uni.setNavigationBarTitle({ title: '编辑客户资料' }); load() }
  else uni.setNavigationBarTitle({ title: '新建客户' })
})

async function load() {
  const c = await crmApi.info(id.value)
  if (!c) return
  name.value = c.name; phone.value = c.phone
  phoneLocked.value = Boolean(c.lastFollowAt)
  gender.value = c.gender || 'M'; genderIdx.value = gender.value === 'F' ? 1 : 0
  source.value = c.source
  community.value = c.community || ''; addr.value = c.addr || ''
  area.value = c.area ? `${c.area}` : ''
  budget.value = c.budget ? `${c.budget}` : ''; remark.value = c.remark || ''
}

async function save() {
  if (!name.value.trim()) { toast('请填写客户姓名'); return }
  if (!/^1\d{10}$/.test(phone.value)) { toast('请填写正确手机号'); return }
  loading('保存中…')
  try {
    const payload: Partial<Customer> = {
      id: id.value || undefined,
      name: name.value.trim(), phone: phone.value,
      gender: gender.value, source: source.value,
      community: community.value.trim(), addr: addr.value.trim(),
      area: area.value ? Number(area.value) : undefined,
      budget: budget.value ? Number(budget.value) : undefined,
      remark: remark.value.trim(), owner: session.emp || undefined
    }
    await crmApi.save(payload)
    toast('保存成功', 'success')
    setTimeout(() => uni.navigateBack(), 400)
  } catch (error) {
    toastError(error, '客户保存失败')
  } finally {
    hideLoading()
  }
}
</script>

<template>
  <view class="ce">
    <view class="ce__notice">客户资料编辑只维护基础信息；客户阶段、添加微信、到店和量房请在客户详情中通过对应业务动作办理。</view>
    <view class="ce__card jz-card">
      <view class="ce__row">
        <text class="ce__label">客户姓名 <text class="req">*</text></text>
        <input v-model="name" placeholder="怎么称呼？" />
      </view>
      <view class="ce__row">
        <text class="ce__label">手机号 <text class="req">*</text></text>
        <view class="ce__phone">
          <input v-model="phone" type="number" maxlength="11" placeholder="客户手机号" :disabled="phoneLocked" />
          <text v-if="phoneLocked" class="ce__phone-lock">首联跟进后不可修改</text>
        </view>
      </view>
      <view class="ce__row">
        <text class="ce__label">性别</text>
        <picker :range="GENDERS" :value="genderIdx" @change="genderIdx = Number($event.detail.value); gender = genderIdx === 1 ? 'F' : 'M'">
          <view class="ce__picker"><text>{{ GENDERS[genderIdx] }}</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" /></view>
        </picker>
      </view>
      <view class="ce__row">
        <text class="ce__label">客户来源</text>
        <picker :range="SOURCES.map(s => s.label)" @change="source = SOURCES[Number($event.detail.value)].key">
          <view class="ce__picker"><text>{{ SOURCES.find(s => s.key === source)?.label }}</text><JzIcon name="chevron-right" :size="26" :color="TOKEN_COLOR.text4" /></view>
        </picker>
      </view>
      <view class="ce__row">
        <text class="ce__label">意向小区</text>
        <input v-model="community" placeholder="例：江南新苑" />
      </view>
      <view class="ce__row">
        <text class="ce__label">房屋地址</text>
        <input v-model="addr" maxlength="200" placeholder="详细地址，转待量房前必填" />
      </view>
      <view class="ce__row">
        <text class="ce__label">面积(㎡)</text>
        <input v-model="area" type="digit" placeholder="例：118" />
      </view>
      <view class="ce__row">
        <text class="ce__label">预算(万)</text>
        <input v-model="budget" type="digit" placeholder="例：30" />
      </view>
      <view class="ce__row ce__row--col">
        <text class="ce__label">备注</text>
        <textarea v-model="remark" class="ce__textarea" placeholder="客户关注点、异议、忌口等" maxlength="200" />
      </view>
    </view>
    <view class="jz-actionbar">
      <view class="jz-actionbar__inner">
        <button class="jz-btn jz-btn--primary jz-grow" @tap="save">保存客户</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ce { padding-bottom: 168rpx; }
.ce__notice { margin: 24rpx 28rpx 0; padding: 24rpx; color: $jzb-text-2; background: $jzb-primary-lightest; border-radius: $jzb-radius; font-size: $jzb-font-xs; line-height: 1.65; }
.ce__card { margin: 28rpx; padding: 0 28rpx; }
.ce__row { display: flex; align-items: center; min-height: 104rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
/* 纵向行（备注等）：标签独占一行，控件占满整行宽度 */
.ce__row--col { flex-direction: column; align-items: stretch; padding: 24rpx 0; }
.ce__label { width: 170rpx; color: $jzb-text-2; font-size: $jzb-font-sm; flex-shrink: 0; }
.ce__row--col .ce__label { width: auto; }
.req { color: $jzb-danger; }
.ce__row input { flex: 1; min-width: 0; color: $jzb-text-1; font-size: $jzb-font; text-align: right; }
.ce__phone { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-end; }
.ce__phone input { width: 100%; }
.ce__phone-lock { margin-top: 6rpx; color: $jzb-text-4; font-size: 20rpx; }
/* 纵向行的输入框：整行宽度 + 左对齐 */
.ce__row--col input { flex: none; width: 100%; margin-top: 12rpx; text-align: left; }
/* picker 撑满剩余宽度，选中值才能真正靠右 */
.ce__row picker { flex: 1; min-width: 0; }
.ce__picker { display: flex; align-items: center; justify-content: flex-end; gap: 8rpx; color: $jzb-text-1; font-size: $jzb-font; }
.ce__picker > text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ce__textarea { width: 100%; height: 170rpx; margin-top: 12rpx; padding: 18rpx 20rpx; color: $jzb-text-1; background: $jzb-bg-hover; border-radius: $jzb-radius-sm; font-size: $jzb-font; }
</style>
