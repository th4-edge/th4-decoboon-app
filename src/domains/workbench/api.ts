import { post } from '@/core/http'
import type { DesignWorkbenchItem, QuoteWorkbenchItem, SignWorkbenchItem } from './model'

type Raw = Record<string, unknown>

function normalizeDesign(raw: Raw): DesignWorkbenchItem {
  return {
    custId: String(raw.custId ?? ''),
    propertyId: raw.propertyId ? String(raw.propertyId) : null,
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    community: String(raw.community ?? ''),
    addr: String(raw.addr ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    measureAt: raw.measureAt ? String(raw.measureAt) : null,
    pendingMeasureAt: raw.pendingMeasureAt ? String(raw.pendingMeasureAt) : null,
    designStatus: (raw.designStatus as DesignWorkbenchItem['designStatus']) || 'Pending',
    designStatusName: String(raw.designStatusName ?? ''),
    schemeCount: Number(raw.schemeCount ?? 0),
    hasRequirement: raw.hasRequirement === true,
    lastDesignAt: raw.lastDesignAt ? String(raw.lastDesignAt) : null,
    stayDays: Number(raw.stayDays ?? 0)
  }
}

function normalizeQuote(raw: Raw): QuoteWorkbenchItem {
  return {
    custId: String(raw.custId ?? ''),
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    community: String(raw.community ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    propertyId: String(raw.propertyId ?? ''),
    quoteId: String(raw.quoteId ?? ''),
    quoteNo: String(raw.quoteNo ?? ''),
    version: Number(raw.version ?? 1),
    amount: Number(raw.amount ?? 0),
    quoteStatus: (raw.quoteStatus as QuoteWorkbenchItem['quoteStatus']) || 'Draft',
    quoteStatusName: String(raw.quoteStatusName ?? ''),
    submittedAt: raw.submittedAt ? String(raw.submittedAt) : null,
    lastFeedbackAt: raw.lastFeedbackAt ? String(raw.lastFeedbackAt) : null,
    adjustmentCount: Number(raw.adjustmentCount ?? 0),
    stayDays: Number(raw.stayDays ?? 0)
  }
}

function normalizeSign(raw: Raw): SignWorkbenchItem {
  return {
    custId: String(raw.custId ?? ''),
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    community: String(raw.community ?? ''),
    addr: String(raw.addr ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    propertyId: String(raw.propertyId ?? ''),
    quoteId: String(raw.quoteId ?? ''),
    quoteNo: String(raw.quoteNo ?? ''),
    version: Number(raw.version ?? 1),
    acceptedAmount: Number(raw.acceptedAmount ?? 0),
    acceptedAt: raw.acceptedAt ? String(raw.acceptedAt) : null,
    converted: raw.converted === true,
    contractId: raw.contractId ? String(raw.contractId) : null,
    contractStatus: String(raw.contractStatus ?? ''),
    contractStatusName: String(raw.contractStatusName ?? ''),
    signedAt: raw.signedAt ? String(raw.signedAt) : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    projectName: raw.projectName ? String(raw.projectName) : null,
    stayDays: Number(raw.stayDays ?? 0)
  }
}

export const workbenchApi = {
  /** 设计工作台：需要出设计方案的客户房屋列表 */
  design: async (): Promise<DesignWorkbenchItem[]> => {
    const raw = await post<Raw[]>('statistic/workbench/design/page', {})
    return (raw || []).map(normalizeDesign)
  },

  /** 报价工作台：需要编制/跟进报价确认的客户房屋列表 */
  quote: async (): Promise<QuoteWorkbenchItem[]> => {
    const raw = await post<Raw[]>('statistic/workbench/quote/page', {})
    return (raw || []).map(normalizeQuote)
  },

  /** 签约工作台：报价已确认、待签约立项的客户房屋列表 */
  sign: async (): Promise<SignWorkbenchItem[]> => {
    const raw = await post<Raw[]>('statistic/workbench/sign/page', {})
    return (raw || []).map(normalizeSign)
  }
}
