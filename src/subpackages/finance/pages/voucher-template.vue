<script setup lang="ts">
import { TOKEN_COLOR } from '@/styles/tokens'
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { templateApi, type DocumentLayoutConfig, type DocumentTemplateInfo, type DocumentTemplateVersionInfo } from '@/domains/document/api'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { hideLoading, loading, toast, toastError } from '@/composables/toast'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzSkeleton from '@/components/JzSkeleton.vue'
import PageState from '@/components/PageState/PageState.vue'
import JzSelectField from '@/components/JzSelectField/JzSelectField.vue'

type TemplateType = 'Receipt' | 'Payment'

interface FieldMeta { key: string; label: string; value: string }

const DEFAULT_FIELDS: Record<string, boolean> = {
  showCompanyName: true,
  showServiceHotline: true,
  showVoucherNo: true,
  showVoucherDate: true,
  showPartyName: true,
  showWorkerPhone: true,
  showWorkerIdCard: true,
  showWorkerTrade: true,
  showProject: true,
  showAmount: true,
  showAmountWords: true,
  showSignBlock: true,
  showDetailNo: true,
  showDetailDate: true,
  showDetailAccount: true,
  showDetailAmount: true,
  showDetailTarget: true,
  showDetailCategory: false,
  showDetailRemark: false
}

const HEADER_FIELDS = [
  { key: 'showVoucherNo', label: '凭证编号' },
  { key: 'showVoucherDate', label: '开具日期' },
  { key: 'showPartyName', label: '对方名称' },
  { key: 'showWorkerPhone', label: '联系电话' },
  { key: 'showWorkerIdCard', label: '身份证号码' },
  { key: 'showWorkerTrade', label: '工种' },
  { key: 'showProject', label: '所属项目' },
  { key: 'showAmount', label: '金额合计' },
  { key: 'showAmountWords', label: '金额大写' },
  { key: 'showSignBlock', label: '签字栏' }
]

const DETAIL_FIELDS = [
  { key: 'showDetailNo', label: '来源单号' },
  { key: 'showDetailDate', label: '日期' },
  { key: 'showDetailAccount', label: '支付账户' },
  { key: 'showDetailAmount', label: '金额' },
  { key: 'showDetailTarget', label: '到账账户' },
  { key: 'showDetailCategory', label: '款项类型' },
  { key: 'showDetailRemark', label: '备注' }
]

const ORG_FIELDS = [
  { key: 'showCompanyName', label: '企业全称' },
  { key: 'showServiceHotline', label: '服务热线' }
]

const LAYOUT_BLOCKS: Array<{ key: string; label: string }> = [
  { key: 'company', label: '企业抬头' },
  { key: 'title', label: '凭证标题' },
  { key: 'meta', label: '凭证信息' },
  { key: 'amount', label: '金额区' },
  { key: 'detail', label: '明细表' },
  { key: 'sign', label: '签字栏' },
  { key: 'footer', label: '页脚说明' }
]

const DEFAULT_LAYOUT: DocumentLayoutConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginMm: 12,
  blocks: LAYOUT_BLOCKS.map((item, index) => ({ key: item.key, visible: true, sort: (index + 1) * 10 })),
  signatures: ['制单', '审核', '领款/付款人'],
  footer: '本凭证为款项收付单据打印稿，用于企业留档；不属于会计记账凭证，不替代会计做账。'
}

const templateType = ref<TemplateType>('Payment')
const presetCode = ref('')
const fields = reactive<Record<string, boolean>>({ ...DEFAULT_FIELDS })
const style = reactive({ primaryColor: '#0E8A7D', fontSize: 12, rowSpacing: 2 })
const layout = reactive<DocumentLayoutConfig>(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)))
const form = reactive({ name: '工资发放凭证' })
const templates = ref<Record<string, { name: string; fieldConfig: Record<string, boolean>; styleConfig: typeof style; layoutConfig: DocumentLayoutConfig }>>({})
const presets = ref<DocumentTemplateInfo[]>([])
const activePresetCode = ref('')
const activeTemplateId = ref('')
const versions = ref<DocumentTemplateVersionInfo[]>([])
const versionLoading = ref(false)
const booting = ref(false)
const loadError = ref('')
const saving = ref(false)
const publishing = ref(false)
const canSave = computed(() => can(session.role, 'edit:doc-template'))

const typeOptions: Array<{ label: string; value: TemplateType }> = [
  { label: '付款单', value: 'Payment' },
  { label: '收款单', value: 'Receipt' }
]

/** 预览用的示例数据，与凭证渲染字段一一对应。 */
const sample: FieldMeta[] = [
  { key: 'showVoucherNo', label: '凭证编号', value: 'PZ20260331121705260671' },
  { key: 'showVoucherDate', label: '开具日期', value: '2026-03-31' },
  { key: 'showPartyName', label: '收款人', value: '张伟' },
  { key: 'showWorkerPhone', label: '联系电话', value: '18660219910' },
  { key: 'showWorkerIdCard', label: '身份证号码', value: '341222********5970' },
  { key: 'showWorkerTrade', label: '工种', value: '木工' },
  { key: 'showProject', label: '所属项目', value: '梦圆小区 222-201' },
  { key: 'showDetailTarget', label: '到账账户', value: '***********1266' }
]

const visibleMeta = computed(() => sample.filter((item) => fields[item.key]))
const detailColumns = computed(() => DETAIL_FIELDS.filter((item) => fields[item.key]))
const detailRow = computed<Record<string, string>>(() => ({
  showDetailNo: 'PZ20260331121705260671',
  showDetailDate: '2026-03-31',
  showDetailAccount: '企业对公',
  showDetailAmount: '40.00',
  showDetailTarget: '***********1266',
  showDetailCategory: '工人工资',
  showDetailRemark: '3 月工资'
}))
const orgLine = computed(() => {
  const parts: string[] = []
  if (fields.showCompanyName) parts.push('合肥测试装饰工程有限公司')
  if (fields.showServiceHotline) parts.push('服务热线 0551-8888 6666')
  return parts.join(' · ')
})

onLoad((query) => {
  if (!isLoggedIn()) { uni.reLaunch({ url: P.login }); return }
  if (!can(session.role, 'view:finance')) { toast('当前账号无财务查看权限'); setTimeout(() => uni.navigateBack(), 600); return }
  presetCode.value = query?.preset || ''
  const type = query?.type
  if (type === 'Receipt' || type === 'Payment') templateType.value = type
  void boot()
})

async function boot() {
  booting.value = true
  loadError.value = ''
  try {
    const [list, presetList] = await Promise.all([templateApi.templates(), templateApi.presets()])
    presets.value = presetList
    list.forEach((item) => {
      templates.value[item.presetCode || item.type] = {
        name: item.name,
        fieldConfig: item.fieldConfig,
        styleConfig: item.styleConfig,
        layoutConfig: item.layoutConfig ?? JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
      }
    })
    const enterprise = presetCode.value ? templates.value[presetCode.value] : undefined
    const preset = presetList.find((item) => item.presetCode === presetCode.value)
    if (enterprise) {
      const template = list.find((item) => item.presetCode === presetCode.value && item.templateId)
      activeTemplateId.value = template?.templateId ?? ''
      apply(templateType.value)
      if (activeTemplateId.value) await loadVersions(activeTemplateId.value)
    } else if (preset) {
      templateType.value = preset.type as TemplateType
      applyPreset(preset)
    } else {
      apply(templateType.value)
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '模板加载失败'
    toastError(error, '模板加载失败')
  } finally {
    booting.value = false
  }
}

function apply(type: TemplateType) {
  const target = templates.value[presetCode.value || type]
  Object.keys(DEFAULT_FIELDS).forEach((key) => { fields[key] = DEFAULT_FIELDS[key] })
  if (target) {
    Object.entries(target.fieldConfig).forEach(([key, value]) => { fields[key] = value })
    form.name = target.name
    style.primaryColor = target.styleConfig.primaryColor
    style.fontSize = target.styleConfig.fontSize
    style.rowSpacing = target.styleConfig.rowSpacing
    Object.assign(layout, JSON.parse(JSON.stringify(target.layoutConfig ?? DEFAULT_LAYOUT)))
  } else {
    form.name = type === 'Receipt' ? '客户收款凭证' : '工资发放凭证'
    Object.assign(layout, JSON.parse(JSON.stringify(DEFAULT_LAYOUT)))
  }
}

function switchType(type: TemplateType) {
  templateType.value = type
  activePresetCode.value = ''
  activeTemplateId.value = ''
  presetCode.value = ''
  versions.value = []
  apply(type)
}

/** 套用平台常用模板：只改表单，保存后才成为企业模板。 */
function applyPreset(preset: DocumentTemplateInfo) {
  activePresetCode.value = preset.presetCode || ''
  activeTemplateId.value = ''
  versions.value = []
  form.name = preset.name
  Object.keys(DEFAULT_FIELDS).forEach((key) => { fields[key] = DEFAULT_FIELDS[key] })
  Object.entries(preset.fieldConfig).forEach(([key, value]) => { fields[key] = value })
  style.primaryColor = preset.styleConfig.primaryColor
  style.fontSize = preset.styleConfig.fontSize
  style.rowSpacing = preset.styleConfig.rowSpacing
  Object.assign(layout, JSON.parse(JSON.stringify(preset.layoutConfig ?? DEFAULT_LAYOUT)))
}

function setPageSize(value: string) {
  if (value === 'A3' || value === 'A4' || value === 'A5') layout.pageSize = value
}

function moveLayoutBlock(index: number, delta: number) {
  const ordered = [...layout.blocks].sort((left, right) => left.sort - right.sort)
  const target = index + delta
  if (target < 0 || target >= ordered.length) return
  const current = ordered[index]
  ordered[index] = ordered[target]
  ordered[target] = current
  ordered.forEach((item, order) => { item.sort = (order + 1) * 10 })
  layout.blocks = ordered
}

async function loadVersions(templateId: string) {
  if (!templateId) { versions.value = []; return }
  versionLoading.value = true
  try {
    versions.value = await templateApi.templateVersions(templateId)
  } catch (error) {
    toastError(error, '版本历史加载失败')
  } finally {
    versionLoading.value = false
  }
}

async function publish() {
  if (!activeTemplateId.value || !canSave.value || publishing.value) return
  publishing.value = true
  try {
    const saved = await templateApi.publishTemplate(activeTemplateId.value)
    await loadVersions(activeTemplateId.value)
    toast(`已发布 V${saved.publishedVersion ?? saved.version}`)
  } catch (error) {
    toastError(error, '模板发布失败')
  } finally {
    publishing.value = false
  }
}

async function disable() {
  if (!activeTemplateId.value || !canSave.value || publishing.value) return
  publishing.value = true
  try {
    await templateApi.disableTemplate(activeTemplateId.value)
    await loadVersions(activeTemplateId.value)
    toast('发布版本已停用')
  } catch (error) {
    toastError(error, '模板停用失败')
  } finally {
    publishing.value = false
  }
}

async function save() {
  if (!canSave.value || saving.value) return
  saving.value = true
  loading('保存模板中')
  try {
    const payload: Record<string, boolean> = {}
    Object.keys(DEFAULT_FIELDS).forEach((key) => { payload[key] = fields[key] })
    const saved = await templateApi.saveTemplate({
      type: templateType.value,
      presetCode: activePresetCode.value || presetCode.value || undefined,
      name: form.name.trim() || (templateType.value === 'Receipt' ? '客户收款凭证' : '工资发放凭证'),
      fieldConfig: payload,
      styleConfig: { ...style },
      layoutConfig: JSON.parse(JSON.stringify(layout))
    })
    templates.value[saved.presetCode || saved.type] = {
      name: saved.name,
      fieldConfig: saved.fieldConfig,
      styleConfig: saved.styleConfig,
      layoutConfig: saved.layoutConfig ?? JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
    }
    activeTemplateId.value = saved.templateId ?? ''
    await loadVersions(activeTemplateId.value)
    hideLoading()
    toast(`已保存为企业模板（版本 ${saved.version}）`)
    presetCode.value = ''
  } catch (error) {
    hideLoading()
    toastError(error, '模板保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="tpl-page">
    <JzPageHeader title="凭证模板" :subtitle="presetCode ? '平台常用模板 · 保存后成为企业模板' : '企业模板 · 保存后版本自增'" />

    <PageState v-if="loadError" state="error" title="模板加载失败" :subtitle="loadError" @retry="boot" />
    <JzSkeleton v-else-if="booting" :rows="4" />

    <view v-else class="tpl-body">
      <view class="tpl-config">
        <view class="tpl-block">
          <view class="tpl-types">
            <view
              v-for="option in typeOptions"
              :key="option.value"
              class="tpl-type"
              :class="{ 'tpl-type--on': templateType === option.value }"
              @tap="switchType(option.value)"
            >{{ option.label }}</view>
          </view>
          <view class="tpl-row">
            <text class="tpl-label">凭证名称</text>
            <input v-model="form.name" class="tpl-input" placeholder="如 工资发放凭证" />
          </view>
        </view>

        <view class="tpl-block">
          <text class="tpl-block__title">企业抬头</text>
          <view class="tpl-fields">
            <view v-for="item in ORG_FIELDS" :key="item.key" class="tpl-field" @tap="fields[item.key] = !fields[item.key]">
              <view class="tpl-check" :class="{ 'tpl-check--on': fields[item.key] }" />
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="tpl-block">
          <text class="tpl-block__title">凭证头信息</text>
          <view class="tpl-fields">
            <view v-for="item in HEADER_FIELDS" :key="item.key" class="tpl-field" @tap="fields[item.key] = !fields[item.key]">
              <view class="tpl-check" :class="{ 'tpl-check--on': fields[item.key] }" />
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="tpl-block">
          <text class="tpl-block__title">明细行信息</text>
          <view class="tpl-fields">
            <view v-for="item in DETAIL_FIELDS" :key="item.key" class="tpl-field" @tap="fields[item.key] = !fields[item.key]">
              <view class="tpl-check" :class="{ 'tpl-check--on': fields[item.key] }" />
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="tpl-block">
          <text class="tpl-block__title">样式</text>
          <view class="tpl-row">
            <text class="tpl-label">字号 {{ style.fontSize }} px</text>
            <slider class="tpl-slider" :value="style.fontSize" :min="9" :max="14" :step="1" active:color="TOKEN_COLOR.primary" @change="style.fontSize = Number(($event as any).detail.value)" />
          </view>
          <view class="tpl-row">
            <text class="tpl-label">主色</text>
            <view class="tpl-colors">
              <view
                v-for="color in ['#2F6E63', '#5C7C6E', '#4F708C', '#A65F46', '#7A5540', '#675D7B', '#3F4B53']"
                :key="color"
                class="tpl-color"
                :class="{ 'tpl-color--on': style.primaryColor.toUpperCase() === color }"
                :style="{ background: color }"
                @tap="style.primaryColor = color"
              />
            </view>
          </view>
        </view>

        <view class="tpl-block">
          <text class="tpl-block__title">版式设置</text>
          <view class="tpl-row">
            <text class="tpl-label">纸张</text>
            <JzSelectField variant="boxed" :display="layout.pageSize" :range="['A3','A4','A5']" :index="Math.max(0, ['A3','A4','A5'].indexOf(layout.pageSize))" @change="setPageSize" />
          </view>
          <view class="tpl-row">
            <text class="tpl-label">方向</text>
            <view class="tpl-types">
              <view class="tpl-type" :class="{ 'tpl-type--on': layout.orientation === 'portrait' }" @tap="layout.orientation = 'portrait'">纵向</view>
              <view class="tpl-type" :class="{ 'tpl-type--on': layout.orientation === 'landscape' }" @tap="layout.orientation = 'landscape'">横向</view>
            </view>
          </view>
          <view class="tpl-row">
            <text class="tpl-label">页边距 {{ layout.marginMm }} mm</text>
            <slider class="tpl-slider" :value="layout.marginMm" :min="8" :max="20" :step="1" active:color="TOKEN_COLOR.primary" @change="layout.marginMm = Number(($event as any).detail.value)" />
          </view>
        </view>

        <view class="tpl-block">
          <text class="tpl-block__title">区块顺序与显隐</text>
          <view v-for="(block, index) in [...layout.blocks].sort((a, b) => a.sort - b.sort)" :key="block.key" class="tpl-layout-row">
            <view class="tpl-field" @tap="block.visible = !block.visible">
              <view class="tpl-check" :class="{ 'tpl-check--on': block.visible }" />
              <text>{{ LAYOUT_BLOCKS.find((item) => item.key === block.key)?.label ?? block.key }}</text>
            </view>
            <view class="tpl-layout-actions">
              <text class="tpl-layout-btn" @tap="moveLayoutBlock(index, -1)">上移</text>
              <text class="tpl-layout-btn" @tap="moveLayoutBlock(index, 1)">下移</text>
            </view>
          </view>
        </view>

        <view v-if="canSave" class="tpl-actions">
          <button class="tpl-save" :disabled="saving" @tap="save">保存为企业模板</button>
          <view v-if="activeTemplateId" class="tpl-version-actions">
            <button class="tpl-secondary" :disabled="publishing" @tap="publish">发布当前版本</button>
            <button class="tpl-secondary" :disabled="publishing" @tap="disable">停用发布版本</button>
          </view>
        </view>
        <view v-else class="tpl-tip">仅企业负责人可保存模板；当前为只读预览</view>

        <view v-if="activeTemplateId" class="tpl-block">
          <text class="tpl-block__title">版本历史</text>
          <view v-if="versionLoading" class="tpl-tip">版本加载中…</view>
          <view v-else-if="!versions.length" class="tpl-tip">暂无版本记录</view>
          <view v-for="version in versions" :key="version.versionId" class="tpl-version-row">
            <text class="tpl-version-name">V{{ version.version }} · {{ version.name }}</text>
            <text class="tpl-version-status">{{ version.status }}</text>
          </view>
        </view>
      </view>

      <view class="tpl-preview">
        <scroll-view scroll-y class="tpl-paper-wrap">
          <view class="tpl-paper" :style="{ fontSize: style.fontSize + 'px' }">
            <view v-if="orgLine" class="tpl-paper__org">{{ orgLine }}</view>
            <view class="tpl-paper__title" :style="{ color: style.primaryColor }">{{ form.name || '凭证' }}</view>

            <view class="tpl-paper__meta">
              <view v-for="item in visibleMeta" :key="item.key" class="tpl-paper__cell">
                <text class="tpl-paper__k">{{ item.label }}</text>
                <text class="tpl-paper__v">{{ item.value }}</text>
              </view>
            </view>

            <view v-if="fields.showAmount || fields.showAmountWords" class="tpl-paper__money">
              <view v-if="fields.showAmount" class="tpl-paper__cell">
                <text class="tpl-paper__k">金额合计</text>
                <text class="tpl-paper__v">￥40.00</text>
              </view>
              <view v-if="fields.showAmountWords" class="tpl-paper__cell">
                <text class="tpl-paper__k">金额大写</text>
                <text class="tpl-paper__v">肆拾元整</text>
              </view>
            </view>

            <view class="tpl-paper__table">
              <view class="tpl-paper__tr tpl-paper__tr--head">
                <text v-for="column in detailColumns" :key="column.key" class="tpl-paper__th">{{ column.label }}</text>
              </view>
              <view class="tpl-paper__tr">
                <text v-for="column in detailColumns" :key="column.key" class="tpl-paper__td">{{ detailRow[column.key] }}</text>
              </view>
            </view>

            <view v-if="fields.showSignBlock" class="tpl-paper__sign">制单：张伟　　审核：________　　领款人签字：________</view>
            <view class="tpl-paper__note">本凭证为款项收付单据打印稿，用于企业留档；不属于会计记账凭证。</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tpl-page { min-height: 100vh; background: $jzb-bg-page; }
.tpl-body { display: flex; gap: 24rpx; padding: 0 $jzb-page-pad 24rpx; align-items: flex-start; }
.tpl-config { width: 46%; }
.tpl-preview { flex: 1; min-width: 0; }
.tpl-block { margin-bottom: 18rpx; padding: 20rpx 24rpx; background: $jzb-bg-card; border-radius: $jzb-radius; box-shadow: $jzb-shadow-xs; }
.tpl-block__title { display: block; margin-bottom: 14rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.tpl-types { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.tpl-type { padding: 10rpx 26rpx; border-radius: 999rpx; background: $jzb-bg-page; color: $jzb-text-2; font-size: $jzb-font-sm; }
.tpl-type--on { background: $jzb-primary-lighter; color: $jzb-primary-deep; font-weight: 600; }
.tpl-row { display: flex; align-items: center; gap: 16rpx; }
.tpl-label { flex: none; color: $jzb-text-2; font-size: $jzb-font-sm; white-space: nowrap; }
.tpl-input { flex: 1; min-width: 0; padding: 12rpx 20rpx; background: $jzb-bg-page; border-radius: 10rpx; font-size: $jzb-font-sm; }
.tpl-fields { display: flex; flex-wrap: wrap; gap: 10rpx 18rpx; }
.tpl-field { display: flex; align-items: center; gap: 10rpx; padding: 8rpx 4rpx; font-size: $jzb-font-sm; }
.tpl-check { width: 30rpx; height: 30rpx; border-radius: 8rpx; border: 2rpx solid $jzb-border; flex: none; }
.tpl-check--on { background: $jzb-primary; border-color: $jzb-primary; }
.tpl-slider { flex: 1; margin: 0; }
.tpl-colors { display: flex; gap: 14rpx; }
.tpl-color { width: 44rpx; height: 44rpx; border-radius: 10rpx; border: 2rpx solid transparent; }
.tpl-color--on { border-color: $jzb-text-1; }
.tpl-actions { padding: 8rpx 0 24rpx; }
.tpl-layout-row { display: flex; align-items: center; justify-content: space-between; padding: 10rpx 0; border-bottom: 1rpx solid $jzb-border-light; }
.tpl-layout-actions { display: flex; gap: 18rpx; }
.tpl-layout-btn { color: $jzb-primary-deep; font-size: $jzb-font-sm; }
.tpl-save { height: 84rpx; line-height: 84rpx; color: #fff; background: linear-gradient(135deg, $jzb-primary 0%, $jzb-primary-deep 100%); border-radius: 999rpx; font-size: $jzb-font-md; }
.tpl-save[disabled] { opacity: .6; }
.tpl-version-actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
.tpl-secondary { flex: 1; height: 72rpx; line-height: 72rpx; color: $jzb-primary-deep; background: $jzb-primary-lighter; border-radius: 999rpx; font-size: $jzb-font-sm; }
.tpl-secondary[disabled] { opacity: .5; }
.tpl-version-row { display: flex; justify-content: space-between; padding: 14rpx 0; border-bottom: 1rpx solid $jzb-border-light; font-size: $jzb-font-sm; }
.tpl-version-name { color: $jzb-text-1; }
.tpl-version-status { color: $jzb-text-3; }
.tpl-tip { padding: 16rpx 0 24rpx; color: $jzb-text-3; font-size: $jzb-font-xs; }
.tpl-paper-wrap { max-height: 70vh; }
.tpl-paper { padding: 26rpx 30rpx; background: #fff; border-radius: 12rpx; box-shadow: $jzb-shadow-card; color: $jzb-text-1; }
.tpl-paper__org { text-align: center; color: $jzb-text-3; font-size: 11px; }
.tpl-paper__title { margin: 10rpx 0 18rpx; text-align: center; font-weight: 700; letter-spacing: 4rpx; border-bottom: 2rpx solid $jzb-text-1; padding-bottom: 10rpx; }
.tpl-paper__meta, .tpl-paper__money { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx 24rpx; }
.tpl-paper__money { margin-top: 14rpx; }
.tpl-paper__cell { min-width: 0; }
.tpl-paper__k { display: block; color: $jzb-text-3; font-size: 11px; }
.tpl-paper__v { display: block; border-bottom: 1rpx solid $jzb-border-light; padding-bottom: 4rpx; word-break: break-all; }
.tpl-paper__table { margin-top: 18rpx; border: 1rpx solid $jzb-border; border-radius: 6rpx; overflow: hidden; }
.tpl-paper__tr { display: flex; }
.tpl-paper__tr--head { background: $jzb-bg-page; font-weight: 600; }
.tpl-paper__th, .tpl-paper__td { flex: 1; min-width: 0; padding: 8rpx 10rpx; border-right: 1rpx solid $jzb-border-light; font-size: 11px; word-break: break-all; }
.tpl-paper__sign { margin-top: 18rpx; font-size: 11px; color: $jzb-text-2; }
.tpl-paper__note { margin-top: 14rpx; color: $jzb-text-3; font-size: 10px; }
</style>
