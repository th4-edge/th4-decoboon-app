import { post, listOf } from '@/core/http'
import type { PageData, PageResult } from '@/domains/common/model'
import { toPageData } from '@/domains/common/model'
import { normalizeCustomer } from '../crm/api'
import { normalizeProperty } from '@/domains/property/api'
import { normalizeContractConstructionPlan, normalizeContractPaymentPlan } from '../plan/api'
import { normalizeEmployee } from '@/domains/identity/api'
import type { Contract, ContractChange, ContractLine, ContractWorkbench, Quote, QuoteGroup, QuoteItem, QuoteMode, QuoteStatus } from './model'
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
    formula: raw.formula,
    craft: raw.craft,
    role: enumValue(raw.role),
    differenceType: enumValue(raw.differenceType),
    differenceStatus: enumValue(raw.differenceStatus),
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
    version: Number(raw.version ?? 1),
    area: Number(raw.area ?? 0),
    subtotal: Number(raw.subtotal ?? raw.amount ?? 0),
    amount: Number(raw.amount ?? 0),
    cost: Number(raw.cost ?? 0),
    costComplete: raw.costComplete === true,
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
  sourceQuoteId?: string
  customerId?: string
  propertyId?: string
  designId?: string
  templateId?: string
  mode?: QuoteMode
  area?: number
  discount?: number
  empId?: string
}

export interface QuoteLineInput {
  quoteId: string
  itemId?: string
  baseLineId?: string
  catalogItemId?: string
  quantity?: number
  role?: 'option' | 'upgrade' | 'add' | 'deduct' | 'replace' | 'gift'
  included?: boolean
  sort?: number
  deduct?: boolean
  differenceStatus?: 'pending' | 'confirmed' | 'ignored'
}

export interface QuoteQuery {
  customerId?: string
  status?: QuoteStatus
  current?: number
  size?: number
}

function normalizeContract(raw: RawRecord): Contract {
  const baselineAmount = Number(raw.baselineAmount ?? raw.amount ?? 0)
  const signedAmount = raw.signedAmount == null ? undefined : Number(raw.signedAmount)
  return {
    ...raw,
    id: String(raw.id ?? raw.contractId ?? ''),
    no: raw.no ?? '',
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    projectId: String(raw.projectId ?? raw.project?.projectId ?? ''),
    quoteId: raw.quoteId ? String(raw.quoteId) : raw.quote?.quoteId ? String(raw.quote.quoteId) : undefined,
    baselineAmount,
    signedAmount,
    currentAmount: Number(raw.currentAmount ?? baselineAmount),
    amount: Number(raw.currentAmount ?? raw.amount ?? baselineAmount),
    status: CONTRACT_STATUS[enumValue(raw.status)] || 'draft',
    signedAt: dateTimeValue(raw.signedAt),
    startDate: raw.startDate,
    planEndDate: raw.planEndDate,
    paymentTerms: raw.paymentTerms,
    paymentPlan: normalizeContractPaymentPlan(raw.paymentPlan),
    constructionPlan: normalizeContractConstructionPlan(raw.constructionPlan),
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    receivableCount: Number(raw.receivableCount ?? 0),
    receivableAmount: Number(raw.receivableAmount ?? 0),
    receivedAmount: Number(raw.receivedAmount ?? 0),
    pendingChangeCount: Number(raw.pendingChangeCount ?? 0),
    signedCost: raw.signedCost == null ? undefined : Number(raw.signedCost),
    costComplete: raw.costComplete === true,
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
    const uri = session.role === 'pm'
      ? 'project/manager/quote/page'
      : session.role === 'designer' ? 'quote/designer/page' : 'quote/page'
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
    const uri = session.role === 'pm'
      ? 'project/manager/quote/info'
      : session.role === 'designer' ? 'quote/designer/info' : 'quote/info'
    return post<RawRecord>(uri, { quoteId: id }).then(normalizeQuote)
  },
  createQuote: (input: QuoteInput) =>
    post<RawRecord>('quote/save', input).then(normalizeQuote),
  rebaseQuote: (sourceQuoteId: string) =>
    post<RawRecord>('quote/save', { sourceQuoteId }).then(normalizeQuote),
  saveQuoteLine: (input: QuoteLineInput) => post<RawRecord>('quote/line/save', {
    ...input,
    role: input.role ? input.role[0].toUpperCase() + input.role.slice(1) : undefined,
    differenceStatus: input.differenceStatus ? input.differenceStatus[0].toUpperCase() + input.differenceStatus.slice(1) : undefined
  }).then(normalizeItem),
  deleteQuoteLine: (quoteId: string, itemId: string) =>
    post<boolean>('quote/line/delete', { quoteId, itemId }),
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
  generateContract: (quoteId: string, input: { signedAt?: string; signedAmount?: number; startDate?: string; planEndDate?: string; paymentTerms?: string; paymentPlanCode?: string; constructionPlanCode?: string } = {}) =>
    post<RawRecord>('project/contract/save', { quoteId, ...input }).then(normalizeContract),
  updateContract: (contractId: string, status: Contract['status'], input: { signedAt?: string; signedAmount?: number; startDate?: string; planEndDate?: string; paymentTerms?: string; paymentPlanCode?: string; constructionPlanCode?: string } = {}) =>
    post<RawRecord>('project/contract/update', { contractId, status: status[0].toUpperCase() + status.slice(1), ...input }).then(normalizeContract),
  contractWorkbench: async (params: { projectId?: string; contractId?: string }): Promise<ContractWorkbench> => {
    const uri = session.role === 'customer' ? 'customer/contract/workbench' : 'project/contract/workbench'
    return normalizeContractWorkbench(await post<RawRecord>(uri, params))
  },
  contractLines: async (params: { projectId?: string; contractId?: string }): Promise<ContractLine[]> => {
    const uri = session.role === 'customer' ? 'customer/contract-line/page' : 'project/contract-line/page'
    return Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>(uri, params))
      .map(normalizeContractLine))
  },
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
  /**
   * 历史兼容（DEC-068）：仅用于存量 Approved（旧“待客户确认”）单据的一次性收口。
   * 新流程审批通过即生效，App 不再暴露“登记客户确认”动作。
   */
  customerConfirmContractChange: (changeId: string, input: { signatureUrl?: string; evidenceImages?: string[] } = {}) =>
    post<RawRecord>('project/contract-change/customer-confirm', {
      changeId,
      ...input,
      signatureUrl: fileApi.storagePath(input.signatureUrl),
      evidenceImages: input.evidenceImages?.map((path) => fileApi.storagePath(path) || path)
    }).then(normalizeContractChange),
  cancelContractChange: (changeId: string) =>
    post<RawRecord>('project/contract-change/cancel', { changeId }).then(normalizeContractChange),
  contractChangeInfo: (changeId: string) =>
    post<RawRecord>('project/contract-change/info', { changeId }).then(normalizeContractChange),
  batchSaveContractChange: (input: {
    contractId: string
    reason: string
    type?: NonNullable<ContractChange['type']>
    evidenceImages?: string[]
    signatureUrl?: string
    items: Array<{
      /** 仅历史兼容路径使用；新页面由服务端按报价项目库快照生成名称 */
      name?: string
      itemType?: string
      changeType?: NonNullable<ContractChange['type']>
      sourceLineId?: string
      /** 已生效变更目标作为来源（与 sourceLineId 二选一） */
      sourceChangeItemId?: string
      /** 新增/替换：报价项目库目标分项 + 目标工程量（服务端冻结快照与金额） */
      targetCatalogItemId?: string
      targetQuantity?: number
      /** 减项·部分减少：减少量（服务端按当前有效剩余校验上限） */
      reduceQuantity?: number
      newQuantity?: number
      newPrice?: number
      newCost?: number
      amountDelta?: number
      costDelta?: number
      remark?: string
    }>
  }) =>
    post<RawRecord>('project/contract-change/batch-save', {
      contractId: input.contractId,
      reason: input.reason,
      type: input.type ? CHANGE_TYPE_API[input.type] : undefined,
      evidenceImages: input.evidenceImages?.map((path) => fileApi.storagePath(path) || path),
      signatureUrl: fileApi.storagePath(input.signatureUrl),
      items: input.items.map((item) => ({
        name: item.name,
        itemType: item.itemType,
        changeType: item.changeType ? CHANGE_TYPE_API[item.changeType] : undefined,
        sourceLineId: item.sourceLineId,
        sourceChangeItemId: item.sourceChangeItemId,
        targetCatalogItemId: item.targetCatalogItemId,
        targetQuantity: item.targetQuantity,
        reduceQuantity: item.reduceQuantity,
        newQuantity: item.newQuantity,
        newPrice: item.newPrice,
        newCost: item.newCost,
        amountDelta: item.amountDelta,
        costDelta: item.costDelta,
        remark: item.remark
      }))
    }).then(normalizeContractChange),

  /** 增减项草稿预览：与服务端 batch-save 同一套校验/目标快照/差额口径，不落库（预览即所得）。 */
  /**
   * 增减项可变更来源与当前有效剩余（服务端权威投影，仅用于展示与前端预校验）。
   * 正式提交与审批时由服务端重新投影，不得把展示值当作提交依据。
   */
  contractChangeRange: async (input: { contractId: string; sourceLineId?: string; sourceChangeItemId?: string }): Promise<ContractChangeRange> => {
    const raw = await post<RawRecord>('project/contract-change/range', {
      contractId: input.contractId,
      sourceLineId: input.sourceLineId,
      sourceChangeItemId: input.sourceChangeItemId
    })
    return normalizeContractChangeRange(raw)
  },
  previewContractChange: (input: {
    contractId: string
    type?: NonNullable<ContractChange['type']>
    items: Array<{
      changeType?: NonNullable<ContractChange['type']>
      sourceLineId?: string
      sourceChangeItemId?: string
      targetCatalogItemId?: string
      /** 新增/替换：目标工程量（服务端据此冻结目标快照并计算金额；缺失即 400「工程量必须大于 0」） */
      targetQuantity?: number
      reduceQuantity?: number
      newQuantity?: number
      newPrice?: number
      newCost?: number
      amountDelta?: number
      costDelta?: number
      name?: string
      itemType?: string
      remark?: string
    }>
  }) =>
    post<RawRecord>('project/contract-change/preview', {
      contractId: input.contractId,
      type: input.type ? CHANGE_TYPE_API[input.type] : undefined,
      items: input.items.map((item) => ({
        changeType: item.changeType ? CHANGE_TYPE_API[item.changeType] : undefined,
        sourceLineId: item.sourceLineId,
        sourceChangeItemId: item.sourceChangeItemId,
        targetCatalogItemId: item.targetCatalogItemId,
        targetQuantity: item.targetQuantity,
        reduceQuantity: item.reduceQuantity,
        newQuantity: item.newQuantity,
        newPrice: item.newPrice,
        newCost: item.newCost,
        amountDelta: item.amountDelta,
        costDelta: item.costDelta,
        name: item.name,
        itemType: item.itemType,
        remark: item.remark
      }))
    }).then(normalizeContractChange)
}

/** 增减项可变更来源（DEC-055/BR-041）：当前有效剩余 / 待审批占用 / 可变更量由服务端投影。 */
export interface ContractChangeSource {
  group: 'contract' | 'effective'
  sourceLineId?: string
  sourceChangeItemId?: string
  changeId?: string
  changeNo?: string
  name: string
  itemType?: string
  brand?: string
  spec?: string
  /** 区域（原合同行自带；已生效变更目标取其来源行区域，无来源时为空） */
  spaceName?: string
  unit?: string
  /** 单位枚举键（供 unitLabel() 统一展示，Area → ㎡） */
  unitKey?: string
  initialQuantity?: number
  effectiveRemainingQuantity?: number
  pendingReservedQuantity?: number
  availableQuantity?: number
  effectiveRemainingAmount?: number
  currentUnitPrice?: number
  confirmable?: boolean
  blockReason?: string
}

export interface ContractChangeRange {
  contract?: Contract
  sources: ContractChangeSource[]
  selected?: ContractChangeSource
  confirmable?: boolean
}

function numberValue(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function normalizeContractChangeSource(raw: RawRecord): ContractChangeSource {
  return {
    group: (enumValue(raw.group) === 'effective' ? 'effective' : 'contract'),
    sourceLineId: raw.sourceLineId == null ? undefined : String(raw.sourceLineId),
    sourceChangeItemId: raw.sourceChangeItemId == null ? undefined : String(raw.sourceChangeItemId),
    changeId: raw.changeId == null ? undefined : String(raw.changeId),
    changeNo: raw.changeNo ? String(raw.changeNo) : undefined,
    name: String(raw.name || ''),
    itemType: raw.itemType ? enumValue(raw.itemType) : undefined,
    brand: raw.brand ? String(raw.brand) : undefined,
    spec: raw.spec ? String(raw.spec) : undefined,
    spaceName: raw.spaceName ? String(raw.spaceName) : undefined,
    unit: raw.unit ? String(raw.unit) : undefined,
    unitKey: raw.unitKey ? String(raw.unitKey) : undefined,
    initialQuantity: numberValue(raw.initialQuantity),
    effectiveRemainingQuantity: numberValue(raw.effectiveRemainingQuantity),
    pendingReservedQuantity: numberValue(raw.pendingReservedQuantity),
    availableQuantity: numberValue(raw.availableQuantity),
    effectiveRemainingAmount: numberValue(raw.effectiveRemainingAmount),
    currentUnitPrice: numberValue(raw.currentUnitPrice),
    confirmable: raw.confirmable === true,
    blockReason: raw.blockReason ? String(raw.blockReason) : undefined
  }
}

function normalizeContractChangeRange(raw: RawRecord): ContractChangeRange {
  const sources = Array.isArray(raw.sources) ? raw.sources.map(normalizeContractChangeSource) : []
  return {
    contract: raw.contract ? normalizeContract(raw.contract) : undefined,
    sources,
    selected: raw.selected ? normalizeContractChangeSource(raw.selected) : undefined,
    confirmable: raw.confirmable === true
  }
}

function normalizeContractLine(raw: RawRecord): ContractLine {
  const contract = raw.contract || {}
  return {
    id: String(raw.id ?? raw.lineId ?? ''),
    contractId: contract.contractId ? String(contract.contractId) : undefined,
    type: raw.type ? String(enumValue(raw.type)).toLowerCase() : undefined,
    category: raw.category,
    name: raw.name ?? '',
    brand: raw.brand,
    spec: raw.spec,
    unit: UNIT_NAMES[enumValue(raw.unit)] || enumValue(raw.unit) || '项',
    quantity: Number(raw.quantity ?? 0),
    materialPrice: raw.materialPrice === undefined ? undefined : Number(raw.materialPrice),
    manualPrice: raw.manualPrice === undefined ? undefined : Number(raw.manualPrice),
    pricingMode: raw.pricingMode ? String(enumValue(raw.pricingMode)) : undefined,
    amount: Number(raw.amount ?? 0),
    cost: raw.cost === undefined || raw.cost === null ? undefined : Number(raw.cost),
    formula: raw.formula,
    role: raw.role ? String(enumValue(raw.role)) : undefined,
    spaceName: raw.spaceName,
    sort: raw.sort === undefined ? undefined : Number(raw.sort)
  }
}

function normalizeContractWorkbench(raw: RawRecord): ContractWorkbench {
  const receivable = raw.receivable || {}
  const cost = raw.cost || {}
  const progress = raw.progress || {}
  const change = raw.change || {}
  const selection = raw.selection || {}
  return {
    contract: normalizeContract(raw.contract || {}),
    receivable: {
      receivableTotal: Number(receivable.receivableTotal ?? 0),
      receivedTotal: Number(receivable.receivedTotal ?? 0),
      outstandingTotal: Number(receivable.outstandingTotal ?? 0),
      overdueTotal: Number(receivable.overdueTotal ?? 0),
      overdueCount: Number(receivable.overdueCount ?? 0),
      totalCount: Number(receivable.totalCount ?? 0)
    },
    paymentNodes: Array.isArray(raw.paymentNodes) ? raw.paymentNodes.map((node: RawRecord) => ({
      nodeId: node.nodeId === undefined || node.nodeId === null ? undefined : String(node.nodeId),
      code: node.code,
      name: node.name,
      ratio: node.ratio === undefined || node.ratio === null ? undefined : Number(node.ratio),
      amount: Number(node.amount ?? 0),
      receivedAmount: Number(node.receivedAmount ?? 0),
      outstandingAmount: Number(node.outstandingAmount ?? 0),
      triggerType: node.triggerType,
      triggerStageName: node.triggerStageName,
      dueDate: node.dueDate,
      status: node.status,
      statusName: node.statusName,
      receivableId: node.receivableId === undefined || node.receivableId === null ? undefined : String(node.receivableId)
    })) : [],
    cost: {
      estimatedCost: Number(cost.estimatedCost ?? 0),
      actualCost: Number(cost.actualCost ?? 0),
      costComplete: cost.costComplete === true,
      incompleteItemCount: Number(cost.incompleteItemCount ?? 0),
      grossProfit: cost.grossProfit === undefined || cost.grossProfit === null ? null : Number(cost.grossProfit),
      grossMargin: cost.grossMargin === undefined || cost.grossMargin === null ? null : Number(cost.grossMargin)
    },
    progress: {
      projectId: progress.projectId === undefined || progress.projectId === null ? undefined : String(progress.projectId),
      projectNo: progress.projectNo,
      projectName: progress.projectName,
      status: progress.status,
      statusName: progress.statusName,
      percent: Number(progress.percent ?? 0),
      currentStageName: progress.currentStageName,
      stageTotal: Number(progress.stageTotal ?? 0),
      stageDone: Number(progress.stageDone ?? 0),
      pendingAcceptanceCount: Number(progress.pendingAcceptanceCount ?? 0),
      startDate: progress.startDate,
      planEndDate: progress.planEndDate,
      expectedEndDate: progress.expectedEndDate
    },
    change: {
      totalCount: Number(change.totalCount ?? 0),
      pendingCount: Number(change.pendingCount ?? 0),
      approvedCount: Number(change.approvedCount ?? 0),
      confirmedCount: Number(change.confirmedCount ?? 0),
      closedCount: Number(change.closedCount ?? 0),
      confirmedAmount: Number(change.confirmedAmount ?? 0)
    },
    selection: {
      selectionId: selection.selectionId === undefined || selection.selectionId === null ? undefined : String(selection.selectionId),
      version: selection.version === undefined || selection.version === null ? undefined : Number(selection.version),
      status: selection.status,
      statusName: selection.statusName,
      title: selection.title,
      summary: selection.summary,
      designerName: selection.designerName,
      confirmerName: selection.confirmerName,
      confirmedAt: selection.confirmedAt,
      totalCount: Number(selection.totalCount ?? 0)
    }
  }
}
