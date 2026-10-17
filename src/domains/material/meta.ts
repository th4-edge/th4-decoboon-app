import type { MaterialSheetStatus, SheetPriceState } from './model'
import { STATUS_COLOR } from '@/styles/tokens'

/** 作业单状态：文案与颜色统一真源。 */
export const SHEET_STATUS_META: Record<MaterialSheetStatus, { label: string; color: string }> = {
  draft:             { label: '填写中',   color: STATUS_COLOR.todo },
  measuring:         { label: '待测量',   color: STATUS_COLOR.pending },
  measured:          { label: '已测量',   color: STATUS_COLOR.pending },
  submitted:         { label: '待下单',   color: STATUS_COLOR.pending },
  pricing:           { label: '核价中',   color: STATUS_COLOR.pending },
  ordered:           { label: '已下单',   color: STATUS_COLOR.progress },
  partiallyOrdered:  { label: '部分下单', color: STATUS_COLOR.progress },
  partiallyArrived:  { label: '部分到场', color: STATUS_COLOR.progress },
  arrived:           { label: '已到场',   color: STATUS_COLOR.done },
  settled:           { label: '已结算',   color: STATUS_COLOR.done },
  closed:            { label: '已关闭',   color: STATUS_COLOR.done },
  cancelled:         { label: '已取消',   color: STATUS_COLOR.blocked }
}

/** 价格状态：未定价＝成本待结算（利润为 null，不展示 0 成本伪利润）。 */
export const SHEET_PRICE_STATE_META: Record<SheetPriceState, { label: string; color: string }> = {
  priced:   { label: '已定价',     color: STATUS_COLOR.progress },
  unpriced: { label: '成本待结算', color: STATUS_COLOR.pending },
  settled:  { label: '已结算',     color: STATUS_COLOR.done },
  mixed:    { label: '部分已结算', color: STATUS_COLOR.pending }
}

export function sheetStatusMeta(status: MaterialSheetStatus) {
  return SHEET_STATUS_META[status] || SHEET_STATUS_META.draft
}

/** 作业单页面解释：只描述当前事实与下一步，不承担状态流转。 */
export interface MaterialSheetGuidance {
  summary: string
  nextStep: string
}

export function materialSheetGuidance(status: MaterialSheetStatus, priceState?: SheetPriceState): MaterialSheetGuidance {
  const base = (() => {
    switch (status) {
      case 'draft':
        return { summary: '作业单正在填写，尚未提交请购；材料行必须来自已选材的材料计划。', nextStep: '补齐安装位置、型号/颜色/尺寸和当前模板要求的现场时间，再提交请购。' }
      case 'measuring':
      case 'measured':
        return { summary: '作业单已建单，现场测量与时间信息正在确认。', nextStep: '确认测量/配送/安装时间并保存，然后提交请购。' }
      case 'submitted':
      case 'pricing':
        return { summary: '作业单已提交请购，正在等待财务选择供应商并下单。', nextStep: '财务在 App 主材下单工作台打开本单，填写数量与可空单价后确认下单；作业单本身不产生价格或应付。' }
      case 'partiallyOrdered':
        return { summary: '作业单已部分下单，仍有一部分数量未进入采购。', nextStep: '跟踪剩余数量的采购下单，已下单部分等待到场确认。' }
      case 'ordered':
        return { summary: '作业单已进入采购，材料与数量已锁定。', nextStep: '等待供应商送货，由项目经理/设计师确认实际到场数量。' }
      case 'partiallyArrived':
        return { summary: '作业单已部分到场，仍有尾量待确认。', nextStep: '继续在 App 确认剩余到场数量；全部到齐后由财务在 App 主材结算中收敛成本。' }
      case 'arrived':
        return { summary: '作业单已全部到场，材料履约事实已完成。', nextStep: '财务在 App 主材结算中确认结算价；结算前成本未完整时利润仍不确认。' }
      case 'settled':
      case 'closed':
        return { summary: '作业单已完成结算或关闭，当前只保留历史查看。', nextStep: '如需变更已生效材料，请走增减项或退货路径。' }
      case 'cancelled':
        return { summary: '作业单已取消并保留历史，不能继续请购或采购。', nextStep: '如仍需该材料，请从材料计划重新建单。' }
      default:
        return { summary: '作业单状态待业务确认。', nextStep: '刷新后仍不明确时，请联系材料员/财务核对。' }
    }
  })()
  if (priceState === 'unpriced' || priceState === 'mixed') {
    return {
      summary: `${base.summary} 当前采购侧存在未定价或部分结算，成本不完整。`,
      nextStep: `${base.nextStep} 未定价不阻断履约，但利润必须保持为空。`
    }
  }
  return base
}

export const MATERIAL_SHEET_TIME_NOTES = [
  { key: 'measure', label: '测量日期', text: '现场复尺/测量事实，不是系统确认时间。' },
  { key: 'deliver', label: '配送/安装', text: '计划或约定的配送、安装日期。' },
  { key: 'arrival', label: '要求到场/实际到场', text: '在材料计划、采购和到场记录中分别确认，不是作业单时间戳。' }
]
