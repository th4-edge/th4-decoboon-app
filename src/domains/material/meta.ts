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
