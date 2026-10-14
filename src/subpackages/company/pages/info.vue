<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { identityApi } from '@/domains/identity/api'
import type { Company } from '@/domains/identity/model'
import { session } from '@/domains/identity/session'
import { toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzBrandLogo from '@/components/JzBrandLogo.vue'

const company = ref<Company | null>(null)
const editing = ref(false)
const form = ref({ title: '', name: '', addr: '' })
// 品牌与署名：叙事主体归装企（ANS-BIZ-20261010-004 §4）；平台署名默认关闭
const brandPrimary = ref<'Company' | 'Platform'>('Company')
const custodianCredit = ref(false)
const editable = computed(() => session.role === 'boss')

onLoad(async () => {
  try {
    const loaded = await identityApi.companyInfo()
    if (!loaded) throw new Error('企业信息不存在')
    company.value = loaded
    form.value = { title: loaded.name, name: loaded.shortName || '', addr: loaded.city || '' }
    const setting = (loaded.setting || {}) as { brandPrimary?: string; custodianCredit?: boolean }
    brandPrimary.value = setting.brandPrimary === 'Platform' ? 'Platform' : 'Company'
    custodianCredit.value = setting.custodianCredit === true
  } catch (error) { toastError(error, '企业信息加载失败') }
})

function onCreditChange(event: Event) {
  const detail = (event as unknown as { detail?: { value?: boolean } }).detail
  custodianCredit.value = detail?.value === true
}

async function save() {
  try {
    const updated = await identityApi.updateCompany({
      title: form.value.title,
      name: form.value.name,
      addr: form.value.addr,
      setting: { brandPrimary: brandPrimary.value, custodianCredit: custodianCredit.value }
    })
    if (!updated) throw new Error('企业信息更新失败')
    company.value = updated
    editing.value = false
    toast('企业信息已更新', 'success')
  } catch (error) { toastError(error, '企业信息更新失败') }
}
</script>

<template>
  <view class="ci-page">
    <JzPageHeader title="我的企业" subtitle="企业身份与组织归属" :right-text="editable ? '编辑' : ''" @right="editing = true" />
    <view v-if="company" class="ci-body">
      <view class="jz-card ci-hero">
        <view class="ci-logo"><JzBrandLogo variant="white" :size="54" /></view>
        <text class="ci-name">{{ company.name }}</text>
        <text class="ci-addr">{{ company.city || '未填写企业地址' }}</text>
      </view>
      <view v-if="!editing" class="jz-card ci-info">
        <view><text>企业简称</text><text>{{ company.shortName || '-' }}</text></view>
        <view><text>企业地址</text><text>{{ company.city || '-' }}</text></view>
        <view><text>当前门店</text><text>{{ session.emp?.store?.name || '-' }}</text></view>
        <view><text>当前团队</text><text>{{ session.emp?.team?.name || '-' }}</text></view>
        <view><text>叙事主品牌</text><text>{{ brandPrimary === 'Platform' ? '平台' : '装企（默认）' }}</text></view>
        <view><text>记录存证署名</text><text>{{ custodianCredit ? '显示「记录存证与保管 · 装得清」' : '不显示（默认）' }}</text></view>
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
          <switch :checked="custodianCredit" color="#0E8A7D" @change="onCreditChange" />
        </view>
      </view>
      <button v-if="editing" class="jz-btn jz-btn--primary jz-btn--block" @tap="save">保存企业信息</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ci-page { min-height: 100vh; background: $jzb-bg-page; }
.ci-body { padding: 28rpx; }
.ci-hero { padding: 48rpx 32rpx; text-align: center; }
.ci-logo { display: flex; align-items: center; justify-content: center; width: 112rpx; height: 112rpx; margin: 0 auto; background: $jzb-gradient; border-radius: 36rpx; }
.ci-name { display: block; margin-top: 22rpx; color: $jzb-text-1; font-size: $jzb-font-xl; font-weight: 750; }
.ci-addr { display: block; margin-top: 8rpx; color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-info { margin-top: 24rpx; padding: 8rpx 28rpx; }
.ci-info > view { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; border-bottom: 1rpx solid $jzb-border-light; }
.ci-info > view:last-child { border-bottom: none; }
.ci-info text:first-child { color: $jzb-text-3; font-size: $jzb-font-sm; }
.ci-info text:last-child { color: $jzb-text-1; text-align: right; }
.ci-info--form input { flex: 1; margin-left: 24rpx; color: $jzb-text-1; text-align: right; }
.ci-seg { display: flex; gap: 12rpx; }
.ci-seg text { padding: 8rpx 24rpx; border: 1rpx solid $jzb-border-light; border-radius: 999rpx; color: $jzb-text-2; font-size: $jzb-font-sm; }
.ci-seg text.on { border-color: $jzb-primary; background: $jzb-primary-lighter; color: $jzb-primary; font-weight: 650; }
.ci-body > button { margin-top: 28rpx; }
</style>
