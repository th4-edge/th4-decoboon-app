import type { CustomerSource, CustomerStage } from './model'
import { TOKEN_COLOR, STATUS_COLOR } from '@/styles/tokens'

export const CUSTOMER_SOURCE_META: Record<CustomerSource, string> = {
  lead: '短视频线索', referral: '转介绍', walkin: '自然到店',
  old: '老客户', video: '抖音咨询', other: '其他', batch: '批量导入'
}

export const CUSTOMER_STAGE_META: Record<CustomerStage, { label: string; color: string }> = {
  intention:    { label: '待首联',   color: STATUS_COLOR.doing },
  following:    { label: '跟进中',   color: STATUS_COLOR.progress },
  pendingMeasure: { label: '待量房', color: STATUS_COLOR.info },
  quote:        { label: '方案报价', color: STATUS_COLOR.special },
  sign:         { label: '已签约',   color: TOKEN_COLOR.primaryBase },
  construction: { label: '施工中',   color: STATUS_COLOR.alert },
  done:         { label: '已完工',   color: STATUS_COLOR.done },
  lost:         { label: '已流失',   color: STATUS_COLOR.idle }
}

export const CUSTOMER_STAGE_ORDER: CustomerStage[] = [
  'intention', 'following', 'pendingMeasure', 'quote', 'sign', 'construction', 'done'
]
