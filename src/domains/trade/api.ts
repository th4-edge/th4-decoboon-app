import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeCustomer } from '../crm/api'
import { normalizeProperty } from '@/domains/property/api'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Contract, ContractChange, Quote, QuoteGroup, QuoteItem, QuoteMode, QuoteStatus } from './model'
import { normalizeScheme } from '../design/api'
import { dateTimeValue } from '@/core/format'
import { session } from '@/domains/identity/session'
import { fileApi } from '@/domains/file/api'

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? '')
  }
  return ''
}

const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户',
  Metre: 'm', Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根',
  Hole: '扇', Pcs: '台', Stick: '支', Grid: '格', Sheet: '片'
}

const QUOTE_STATUS: Record<string, QuoteStatus> = {
  Draft: 'draft', Submitted: 'submitted', Accepted: 'accepted', Rejected: 'rejected', Superseded: 'superseded', Converted: 'converted'
}
const QUOTE_MODE: Record<string, QuoteMode> = {
  Package: 'package', Custom: 'custom', Hybrid: 'hybrid'
}
const CONTRACT_STATUS: Record<string, Contract['status']> = {
  Draft: 'draft', PendingSign: 'pendingSign', Signed: 'signed', Effective: 'effective',
  Changing: 'changing', Active: 'active', Changed: 'changed', Completed: 'completed',
  Closed: 'closed', Settled: 'settled', Terminated: 'terminated'
}
const CHANGE_STATUS: Record<string, ContractChange['status']> = {
  Pending: 'pending', Approved: 'approved', CustomerConfirmed: 'customerConfirmed',
  Rejected: 'rejected', Cancelled: 'cancelled'
}

const CHANGE_TYPE: Record<string, NonNullable<ContractChange['type']>> = {
  Add: 'add', Remove: 'remove', Replace: 'replace', Quantity: 'quantity', Price: 'price'
}

const CHANGE_TYPE_API: Record<NonNullable<ContractChange['type']>, string> = {
  add: 'Add', remove: 'Remove', replace: 'Replace', quantity: 'Quantity', price: 'Price'
}

function normalizeItem(raw: RawRecord): QuoteItem {
  return {
    ...raw,
    id: String(raw.id ?? raw.itemId ?? ''),
    name: raw.name ?? '',
    type: raw.type ? String(enumValue(raw.type)).toLowerCase() as QuoteItem['type'] : undefined,
    category: raw.category,
    space: raw.space ? { id: String(raw.space.spaceId ?? raw.space.id ?? ''), name: raw.space.name ?? '' } : undefined,
    brand: raw.brand,
    spec: raw.spec,
    unit: UNIT_NAMES[enumValue(raw.unit)] || enumValue(raw.unit) || '项',
    quantity: Number(raw.quantity ?? 0),
    materialPrice: Number(raw.materialPrice ?? 0),
    manualPrice: Number(raw.manualPrice ?? 0),
    pricingMode: enumValue(raw.pricingMode),
    price: Number(raw.price ?? 0),
    amount: Number(raw.amount ?? 0),
    cost: Number(raw.cost ?? 0),
    formula: raw.formula
    ,
    role: enumValue(raw.role),
    included: raw.included !== false,
    discountAmount: Number(raw.discountAmount ?? 0),
    components: Array.isArray(raw.components) ? raw.components.map((component: RawRecord) => ({
      ...component,
      type: enumValue(component.type),
      saleAmount: Number(component.saleAmount ?? 0),
      costAmount: Number(component.costAmount ?? 0)
    })) : undefined
  }
}

function normalizeGroup(raw: RawRecord): QuoteGroup {
  return {
    key: raw.key ?? raw.category ?? raw.name ?? '',
    name: raw.name ?? raw.category ?? '',
    type: raw.type ? String(enumValue(raw.type)).toLowerCase() as QuoteItem['type'] : undefined,
    category: raw.category,
    quantity: Number(raw.quantity ?? 0),
    amount: Number(raw.amount ?? 0),
    cost: Number(raw.cost ?? 0),
    items: raw.items ? (raw.items as RawRecord[]).map(normalizeItem) : []
  }
}

export function normalizeQuote(raw: RawRecord): Quote {
  return {
    ...raw,
    id: String(raw.id ?? raw.quoteId ?? ''),
    no: raw.no ?? '',
    title: raw.title,
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    design: raw.design ? normalizeScheme(raw.design) : undefined,
    packageTemplate: raw.packageTemplate ? {
      id: String(raw.packageTemplate.id ?? raw.packageTemplate.templateId ?? ''),
      name: raw.packageTemplate.name ?? '',
      area: Number(raw.packageTemplate.area ?? 0),
      price: Number(raw.packageTemplate.price ?? 0)
    } : undefined,
    owner: raw.createdBy ? normalizeEmployee(raw.createdBy) : raw.owner ? normalizeEmployee(raw.owner) : undefined,
    mode: QUOTE_MODE[enumValue(raw.mode)] || (raw.packageTemplate ? 'package' : 'custom'),
    area: Number(raw.area ?? 0),
    subtotal: Number(raw.subtotal ?? raw.amount ?? 0),
    amount: Number(raw.amount ?? 0),
    cost: Number(raw.cost ?? 0),
    discount: Number(raw.discount ?? 1),
    taxRate: Number(raw.taxRate ?? 0.05),
    taxAmount: Number(raw.taxAmount ?? 0),
    status: QUOTE_STATUS[enumValue(raw.status)] || 'draft',
    items: raw.items ? (raw.items as RawRecord[]).map(normalizeItem) : undefined,
    regionGroups: raw.regionGroups ? (raw.regionGroups as RawRecord[]).map(normalizeGroup) : undefined,
    constructionGroups: raw.constructionGroups ? (raw.constructionGroups as RawRecord[]).map(normalizeGroup) : undefined,
    materialGroups: raw.materialGroups ? (raw.materialGroups as RawRecord[]).map(normalizeGroup) : undefined,
    otherGroups: raw.otherGroups ? (raw.otherGroups as RawRecord[]).map(normalizeGroup) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export interface QuoteInput {
  customerId?: string
  propertyId?: string
  designId?: string
  templateId?: string
  mode?: QuoteMode
  area?: number
  discount?: number
  empId?: string
}

export interface QuoteQuery {
  customerId?: string
  status?: QuoteStatus
  current?: number
  size?: number
}

function normalizeContract(raw: RawRecord): Contract {
  const baselineAmount = Number(raw.baselineAmount ?? raw.amount ?? 0)
  return {
    ...raw,
    id: String(raw.id ?? raw.contractId ?? ''),
    no: raw.no ?? '',
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    quoteId: raw.quoteId ? String(raw.quoteId) : raw.quote?.quoteId ? String(raw.quote.quoteId) : undefined,
    baselineAmount,
    currentAmount: Number(raw.currentAmount ?? baselineAmount),
    amount: Number(raw.currentAmount ?? raw.amount ?? baselineAmount),
    status: CONTRACT_STATUS[enumValue(raw.status)] || 'draft',
    signedAt: dateTimeValue(raw.signedAt),
    startDate: raw.startDate,
    planEndDate: raw.planEndDate,
    paymentTerms: raw.paymentTerms,
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    receivableCount: Number(raw.receivableCount ?? 0),
    receivableAmount: Number(raw.receivableAmount ?? 0),
    receivedAmount: Number(raw.receivedAmount ?? 0),
    pendingChangeCount: Number(raw.pendingChangeCount ?? 0),
    remark: raw.remark
  }
}

async function normalizeContractChange(raw: RawRecord): Promise<ContractChange> {
  const id = String(raw.id ?? raw.changeId ?? '')
  const evidence = raw.evidenceImages ?? []
  const signature = raw.signatureUrl ? [raw.signatureUrl] : []
  const signed = await fileApi.grant('ContractChange', id, [...evidence, ...signature])
  return {
    ...raw,
    id,
    contractId: String(raw.contractId ?? raw.contract?.contractId ?? ''),
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    no: raw.no ?? '',
    amount: Number(raw.amount ?? 0),
    type: CHANGE_TYPE[enumValue(raw.type)] || 'add',
    costDelta: Number(raw.costDelta ?? 0),
    reason: raw.reason ?? '',
    status: CHANGE_STATUS[enumValue(raw.status)] || 'pending',
    requestedBy: raw.requestedBy ? normalizeEmployee(raw.requestedBy) : undefined,
    approvedBy: raw.approvedBy ? normalizeEmployee(raw.approvedBy) : undefined,
    conclusion: raw.conclusion,
    approvedAt: dateTimeValue(raw.approvedAt),
    customerConfirmed: raw.customerConfirmed === true,
    customerConfirmedAt: dateTimeValue(raw.customerConfirmedAt),
    evidenceImages: signed.slice(0, evidence.length),
    signatureUrl: signature.length ? signed[evidence.length] : undefined,
    items: Array.isArray(raw.items) ? raw.items.map((item: RawRecord) => ({
      id: String(item.id ?? item.changeItemId ?? ''),
      changeType: CHANGE_TYPE[enumValue(item.changeType)] || 'add',
      itemType: item.itemType ? enumValue(item.itemType).toLowerCase() : undefined,
      name: item.name ?? '',
      oldQuantity: Number(item.oldQuantity ?? 0),
      newQuantity: Number(item.newQuantity ?? 0),
      oldPrice: Number(item.oldPrice ?? 0),
      newPrice: Number(item.newPrice ?? 0),
      amountDelta: Number(item.amountDelta ?? 0),
      costDelta: Number(item.costDelta ?? 0),
      remark: item.remark
    })) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

const QUOTE_STATUS_API: Record<QuoteStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', accepted: 'Accepted', rejected: 'Rejected', superseded: 'Superseded', converted: 'Converted'
}

export const tradeApi = {
  page: async (query: QuoteQuery = {}): Promise<PageData<Quote>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const uri = session.role === 'pm' ? 'project/manager/quote/page' : 'quote/page'
    const result = await post<PageResult<RawRecord> | RawRecord[]>(uri, {
      current,
      size,
      customerId: query.customerId,
      status: query.status ? QUOTE_STATUS_API[query.status] : undefined
    })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeQuote) }
  },

  quotes: async (query: QuoteQuery = {}) => {
    const result = await tradeApi.page({ ...query, current: 1, size: query.size ?? 200 })
    return result.list
  },
  quote: (id: string) => {
    const uri = session.role === 'pm' ? 'project/manager/quote/info' : 'quote/info'
    return post<RawRecord>(uri, { quoteId: id }).then(normalizeQuote)
  },
  createQuote: (input: QuoteInput) =>
    post<RawRecord>('quote/save', input).then(normalizeQuote),
  transition: (id: string, status: QuoteStatus) => {
    const statusMap: Record<QuoteStatus, string> = {
      draft: 'Draft', submitted: 'Submitted', accepted: 'Accepted', rejected: 'Rejected', superseded: 'Superseded', converted: 'Converted'
    }
    return post<RawRecord>('quote/update', { quoteId: id, status: statusMap[status] }).then(normalizeQuote)
  },
  saveQuote: (quote: Partial<Quote>) => post<Quote>('quote/save', quote),
  contractByProject: async (projectId: string) => {
    const uri = session.role === 'customer' ? 'customer/contract/info' : 'project/contract/info'
    const raw = await post<RawRecord | null>(uri, { projectId })
    return raw ? normalizeContract(raw) : null
  },
  contractByQuote: async (quoteId: string) => {
    const raw = await post<RawRecord | null>('project/contract/info', { quoteId })
    return raw ? normalizeContract(raw) : null
  },
  generateContract: (quoteId: string, input: { signedAt?: string; startDate?: string; planEndDate?: string; paymentTerms?: string } = {}) =>
    post<RawRecord>('project/contract/save', { quoteId, ...input }).then(normalizeContract),
  updateContract: (contractId: string, status: Contract['status'], input: { startDate?: string; planEndDate?: string; paymentTerms?: string } = {}) =>
    post<RawRecord>('project/contract/update', { contractId, status: status[0].toUpperCase() + status.slice(1), ...input }).then(normalizeContract),
  contractChanges: async (projectId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('project/contract-change/page', { projectId }))
      .map(normalizeContractChange)),
  createContractChange: (
    input: {
      contractId: string; reason: string; amount?: number; type?: NonNullable<ContractChange['type']>
      contractLineId?: string; newQuantity?: number; newPrice?: number; newCost?: number; costDelta?: number
      evidenceImages?: string[]; signatureUrl?: string; reportId?: string
    } | string,
    amount?: number,
    reason?: string
  ) => {
    const value = typeof input === 'string'
      ? { contractId: input, amount, reason: reason || '' }
      : input
    return post<RawRecord>('project/contract-change/save', {
      ...value,
      type: value.type ? CHANGE_TYPE_API[value.type] : undefined,
      evidenceImages: value.evidenceImages?.map((path) => fileApi.storagePath(path) || path),
      signatureUrl: fileApi.storagePath(value.signatureUrl)
    }).then(normalizeContractChange)
  },
  confirmContractChange: (changeId: string, approved: boolean, conclusion?: string) =>
    post<RawRecord>('project/contract-change/update', { changeId, approved, conclusion }).then(normalizeContractChange),
  customerConfirmContractChange: (changeId: string, input: { signatureUrl?: string; evidenceImages?: string[] } = {}) =>
    post<RawRecord>('project/contract-change/customer-confirm', {
      changeId,
      ...input,
      signatureUrl: fileApi.storagePath(input.signatureUrl),
      evidenceImages: input.evidenceImages?.map((path) => fileApi.storagePath(path) || path)
    }).then(normalizeContractChange)
}
