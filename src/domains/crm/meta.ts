import type { CustomerSource, CustomerStage } from './model'

export const CUSTOMER_SOURCE_META: Record<CustomerSource, string> = {
  lead: '短视频线索', referral: '转介绍', walkin: '自然到店',
  old: '老客户', video: '抖音咨询', other: '其他'
}

export const CUSTOMER_STAGE_META: Record<CustomerStage, { label: string; color: string }> = {
  intention:    { label: '待首联',   color: '#13C2C2' },
  following:    { label: '跟进中',   color: '#168A96' },
  pendingMeasure: { label: '待量房', color: '#2F54EB' },
  quote:        { label: '方案报价', color: '#722ED1' },
  sign:         { label: '已签约',   color: '#16A394' },
  construction: { label: '施工中',   color: '#FA8C16' },
  done:         { label: '已完工',   color: '#00B42A' },
  lost:         { label: '已流失',   color: '#C9CDD4' }
}

export const CUSTOMER_STAGE_ORDER: CustomerStage[] = [
  'intention', 'following', 'pendingMeasure', 'quote', 'sign', 'construction', 'done'
]
