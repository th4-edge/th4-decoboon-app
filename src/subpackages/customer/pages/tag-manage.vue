<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerTag } from '@/domains/crm/model'
import { session } from '@/domains/identity/session'
import { confirmDanger, hideLoading, loading, toast, toastError } from '@/composables/toast'
import { TOKEN_COLOR } from '@/styles/tokens'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzIcon from '@/components/JzIcon.vue'
import JzInputDialog from '@/components/JzInputDialog.vue'
import JzConfirmDialog from '@/components/JzConfirmDialog.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

const customerId = ref('')
const customer = ref<Customer | null>(null)
const dictionary = ref<CustomerTag[]>([])
const saving = ref(false)
const newTagName = ref('')
const newTagCategory = ref('intent')
const renameVisible = ref(false)
const renameValue = ref('')
const renameTarget = ref<CustomerTag | null>(null)

const categoryOptions = [
  { value: 'intent', label: '意向' }, { value: 'demand', label: '需求' },
  { value: 'preference', label: '偏好' }, { value: 'value', label: '价值' }, { value: 'risk', label: '风险' }
]
// 历史坑：FIX-tagmanage-role —— 曾误写为全小写 'storemanager'，与 EmployeeRole 定义（驼峰 'storeManager'）不符，导致门店长永远看不到字典维护区
const canMaintainDictionary = computed(() => ['boss', 'storeManager'].includes(session.role || ''))
const systemTags = computed(() => (customer.value?.tags || []).filter((tag) => tag.scope === 'system'))
const manualTags = computed(() => (customer.value?.tags || []).filter((tag) => tag.scope === 'manual'))
const bindableTags = computed(() => {
  const bound = new Set(manualTags.value.map((tag) => tag.id))
  return dictionary.value.filter((tag) => tag.scope === 'manual' && !bound.has(tag.id))
})

function categoryIndex() {
  const index = categoryOptions.findIndex((item) => item.value === newTagCategory.value)
  return index < 0 ? 0 : index
}
function onPickCategory(label: string) {
  newTagCategory.value = categoryOptions.find((o) => o.label === label)?.value || 'intent'
}

async function reload() {
  const [detail, tags] = await Promise.all([
    crmApi.info(customerId.value),
    crmApi.tagList()
  ])
  customer.value = detail
  dictionary.value = tags
}

onLoad(async (query) => {
  customerId.value = query?.customerId || ''
  if (!customerId.value) { toast('缺少客户参数'); return }
  try {
    await reload()
  } catch (error) {
    toastError(error, '标签数据加载失败')
  }
})

async function bind(tag: CustomerTag) {
  if (saving.value) return
  saving.value = true
  loading('正在添加…')
  try {
    await crmApi.tagBind(customerId.value, tag.id)
    await reload()
    toast('标签已添加', 'success')
  } catch (error) {
    toastError(error, '添加标签失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

async function unbind(tag: CustomerTag) {
  if (saving.value) return
  saving.value = true
  loading('正在移除…')
  try {
    await crmApi.tagUnbind(customerId.value, tag.id)
    await reload()
    toast('标签已移除', 'success')
  } catch (error) {
    toastError(error, '移除标签失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

function renameTag(tag: CustomerTag) {
  renameTarget.value = tag
  renameValue.value = tag.name
  renameVisible.value = true
}

async function saveTagRename() {
  const name = renameValue.value.trim()
  if (!name || !renameTarget.value || saving.value) return
  saving.value = true
  loading('正在保存…')
  try {
    await crmApi.tagUpdate({ tagId: renameTarget.value.id, name })
    dictionary.value = await crmApi.tagList()
    renameVisible.value = false
    toast('标签已重命名', 'success')
  } catch (error) {
    toastError(error, '标签重命名失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

async function disableTag(tag: CustomerTag) {
  if (!await confirmDanger('停用标签', `确认停用「${tag.name}」？停用后不可再选用，历史关联保留。`, '确认停用')) return
  saving.value = true
  loading('正在停用…')
  try {
    await crmApi.tagDelete(tag.id)
    dictionary.value = await crmApi.tagList()
    toast('标签已停用', 'success')
  } catch (error) {
    toastError(error, '标签停用失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}

async function createTag() {
  if (saving.value) return
  if (!newTagName.value.trim()) { toast('请填写标签名称'); return }
  saving.value = true
  loading('正在创建…')
  try {
    await crmApi.tagSave({ name: newTagName.value.trim(), category: newTagCategory.value })
    newTagName.value = ''
    dictionary.value = await crmApi.tagList()
    toast('标签已创建', 'success')
  } catch (error) {
    toastError(error, '标签创建失败')
  } finally {
    hideLoading()
    saving.value = false
  }
}
</script>

<template>
  <view class="tm">
    <JzPageHeader title="客户标签" subtitle="系统标签由系统按客户事实自动生成，不可人工增删" />

    <view class="tm__customer jz-card">
      <JzIcon name="user" :size="30" :color="TOKEN_COLOR.primary" />
      <text class="tm__customer-name">{{ customer?.name || '客户' }}</text>
      <text class="tm__customer-sub">人工标签 {{ manualTags.length }} 个</text>
    </view>

    <view class="jz-card tm__block">
      <text class="tm__title">系统标签</text>
      <view v-if="systemTags.length" class="tm__chips">
        <text v-for="tag in systemTags" :key="tag.id" class="tm__chip tm__chip--system">{{ tag.name }}</text>
      </view>
      <text v-else class="tm__empty">暂无系统标签</text>
    </view>

    <view class="jz-card tm__block">
      <text class="tm__title">已选标签</text>
      <view v-if="manualTags.length" class="tm__chips">
        <view v-for="tag in manualTags" :key="tag.id" class="tm__chip tm__chip--bound" @tap="unbind(tag)">
          <text>{{ tag.name }}</text>
          <JzIcon name="close" :size="22" :color="TOKEN_COLOR.danger" />
        </view>
      </view>
      <text v-else class="tm__empty">尚未添加人工标签</text>
    </view>

    <view class="jz-card tm__block">
      <text class="tm__title">可添加标签</text>
      <view v-if="bindableTags.length" class="tm__chips">
        <view v-for="tag in bindableTags" :key="tag.id" class="tm__chip tm__chip--add" @tap="bind(tag)">
          <JzIcon name="plus" :size="22" :color="TOKEN_COLOR.primary" />
          <text>{{ tag.name }}</text>
        </view>
      </view>
      <text v-else class="tm__empty">暂无可添加标签</text>
    </view>

    <view v-if="canMaintainDictionary" class="jz-card tm__block">
      <text class="tm__title">新建标签（仅企业负责人 / 店长）</text>
      <view class="tm__create">
        <input v-model="newTagName" class="tm__input" maxlength="20" placeholder="标签名称" />
        <JzSelectField variant="boxed" :display="categoryOptions[categoryIndex()].label" :range="categoryOptions.map(o => o.label)" :index="categoryIndex()" @change="onPickCategory" />
      </view>
      <button class="jz-btn jz-btn--primary tm__submit" :disabled="saving" @tap="createTag">创建标签</button>
    </view>

    <view v-if="canMaintainDictionary" class="jz-card tm__block">
      <text class="tm__title">字典维护（仅企业负责人 / 店长）</text>
      <view v-if="dictionary.length" class="tm__dict">
        <view v-for="tag in dictionary" :key="tag.id" class="tm__dict-row">
          <text class="tm__dict-name">{{ tag.name }}</text>
          <text class="tm__dict-cat">{{ categoryOptions.find((item) => item.value === tag.category)?.label || tag.category }}</text>
          <text class="tm__dict-action" @tap="renameTag(tag)">改名</text>
          <text class="tm__dict-action tm__dict-action--danger" @tap="disableTag(tag)">停用</text>
        </view>
      </view>
      <text v-else class="tm__empty">暂无标签，可先在上方创建</text>
    </view>

    <view class="jz-tabbar-gap" />
    <JzInputDialog
      :visible="renameVisible"
      title="重命名标签"
      label="标签名称"
      description="历史客户关联不会改变，只会更新标签显示名称。"
      placeholder="请输入新的标签名称"
      :model-value="renameValue"
      :loading="saving"
      confirm-text="保存名称"
      @update:model-value="renameValue = $event"
      @update:visible="renameVisible = $event"
      @confirm="saveTagRename"
    />
  </view>
    <JzConfirmDialog />
</template>

<style lang="scss" scoped>
.tm { min-height: 100vh; padding: 24rpx; background: $jzb-bg-page; }
.tm__customer { display: flex; align-items: center; gap: 14rpx; padding: 24rpx; }
.tm__customer-name { color: $jzb-text-1; font-size: $jzb-font-lg; font-weight: 700; }
.tm__customer-sub { margin-left: auto; color: $jzb-text-3; font-size: 22rpx; }
.tm__block { margin-top: 20rpx; padding: 24rpx; }
.tm__title { color: $jzb-text-1; font-size: 26rpx; font-weight: 700; }
.tm__chips { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.tm__chip { display: flex; align-items: center; gap: 6rpx; padding: 10rpx 20rpx; border-radius: 999rpx; font-size: 22rpx; }
.tm__chip--system { color: $jzb-text-3; background: $jzb-bg-page; border: 1rpx dashed $jzb-border-light; }
.tm__chip--bound { color: $jzb-danger; background: $jzb-danger-soft; }
.tm__chip--add { color: $jzb-primary-dark; background: $jzb-primary-lighter; }
.tm__empty { display: block; margin-top: 14rpx; color: $jzb-text-3; font-size: 22rpx; }
.tm__create { display: flex; align-items: center; gap: 12rpx; margin-top: 16rpx; }
.tm__input { flex: 1; height: 76rpx; padding: 0 20rpx; color: $jzb-text-1; background: $jzb-bg-page; border-radius: 12rpx; font-size: 24rpx; }
.tm__picker { min-width: 150rpx; height: 76rpx; display: flex; align-items: center; justify-content: center; color: $jzb-text-2; background: $jzb-bg-page; border-radius: 12rpx; font-size: 24rpx; }
.tm__submit { margin-top: 20rpx; }
.tm__dict { margin-top: 12rpx; }
.tm__dict-row { display: flex; align-items: center; gap: 12rpx; padding: 16rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.tm__dict-row:last-child { border-bottom: 0; }
.tm__dict-name { flex: 1; min-width: 0; color: $jzb-text-1; font-size: 24rpx; }
.tm__dict-cat { color: $jzb-text-3; font-size: 20rpx; }
.tm__dict-action { color: $jzb-primary-dark; font-size: 22rpx; }
.tm__dict-action--danger { color: $jzb-danger; }
</style>
