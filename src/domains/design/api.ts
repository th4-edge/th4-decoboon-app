import { listOf, post } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import type { PageResult } from '@/domains/common/model'
import { normalizeCustomer } from '../crm/api'
import { normalizeEmployee } from '@/domains/identity/api'
import { normalizeProperty } from '@/domains/property/api'
import type { Quote } from '../trade/model'
import { normalizeCatalogItem } from '../catalog/api'
import type {
  DesignItem, DesignItemType, DesignRequirement, DesignScheme, DesignSpace, DesignStatus,
  DesignContextSnapshot, DesignGenerationMode, DesignGenerationStatus, DesignGenerationTask,
  DesignPromptSnapshot, DesignRenderStatus, DesignRenderVersion,
  PricingMode, RequirementCategory, RequirementKind, RequirementPriority, RequirementStatus,
  SpaceType, TalkPlan, TalkSection, TalkSectionType, TalkStatus
} from './model'
import { fileApi } from '@/domains/file/api'

type RawRecord = Record<string, any>

function enumValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function number(raw: unknown): number {
  return Number(raw ?? 0)
}

const SPACE_TYPE: Record<string, SpaceType> = {
  Bedroom: 'bedroom', Kitchen: 'kitchen', LivingRoom: 'livingRoom',
  DiningRoom: 'diningRoom', Bathroom: 'bathroom', Balcony: 'balcony'
}
const SPACE_TYPE_API: Record<SpaceType, string> = {
  bedroom: 'Bedroom', kitchen: 'Kitchen', livingRoom: 'LivingRoom',
  diningRoom: 'DiningRoom', bathroom: 'Bathroom', balcony: 'Balcony'
}
const REQUIREMENT_KIND: Record<string, RequirementKind> = { Demand: 'demand', Reject: 'reject' }
const REQUIREMENT_KIND_API: Record<RequirementKind, string> = { demand: 'Demand', reject: 'Reject' }
const REQUIREMENT_CATEGORY: Record<string, RequirementCategory> = {
  Function: 'function', Style: 'style', Material: 'material', Budget: 'budget',
  Schedule: 'schedule', Quality: 'quality', Other: 'other'
}
const REQUIREMENT_CATEGORY_API: Record<RequirementCategory, string> = {
  function: 'Function', style: 'Style', material: 'Material', budget: 'Budget',
  schedule: 'Schedule', quality: 'Quality', other: 'Other'
}
const REQUIREMENT_PRIORITY: Record<string, RequirementPriority> = { High: 'high', Medium: 'medium', Low: 'low' }
const REQUIREMENT_PRIORITY_API: Record<RequirementPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const REQUIREMENT_STATUS: Record<string, RequirementStatus> = {
  Pending: 'pending', Confirmed: 'confirmed', Resolved: 'resolved'
}
const DESIGN_STATUS: Record<string, DesignStatus> = {
  Draft: 'draft', Ready: 'ready', Presented: 'presented', Selected: 'selected', Archived: 'archived'
}
const DESIGN_STATUS_API: Record<DesignStatus, string> = {
  draft: 'Draft', ready: 'Ready', presented: 'Presented', selected: 'Selected', archived: 'Archived'
}
const ITEM_TYPE: Record<string, DesignItemType> = {
  General: 'general', Construction: 'construction', Material: 'material',
  Custom: 'custom', Appliance: 'appliance', Soft: 'soft'
}
const ITEM_TYPE_API: Record<DesignItemType, string> = {
  general: 'General', construction: 'Construction', material: 'Material',
  custom: 'Custom', appliance: 'Appliance', soft: 'Soft'
}
const PRICING_MODE: Record<string, PricingMode> = {
  MaterialAndManual: 'materialAndManual', MaterialOnly: 'materialOnly',
  ManualOnly: 'manualOnly', FixedTotal: 'fixedTotal'
}
const PRICING_MODE_API: Record<PricingMode, string> = {
  materialAndManual: 'MaterialAndManual', materialOnly: 'MaterialOnly',
  manualOnly: 'ManualOnly', fixedTotal: 'FixedTotal'
}
const UNIT_VALUES: Record<string, string> = {
  'm²': 'Area', '㎡': 'Area', '平米': 'Area', '个': 'Count', '项': 'Item', '处': 'Place',
  '套': 'Set', '户': 'House', 'm': 'Metre', '米': 'Metre', 'cm': 'Centimeter',
  '步': 'Step', '樘': 'Plate', '块': 'Block', '根': 'Root', '扇': 'Hole',
  '台': 'Pcs', '支': 'Stick', '格': 'Grid', '片': 'Sheet'
}
const UNIT_NAMES: Record<string, string> = {
  Area: '㎡', Count: '个', Item: '项', Place: '处', Set: '套', House: '户',
  Metre: 'm', Centimeter: 'cm', Step: '步', Plate: '樘', Block: '块', Root: '根',
  Hole: '扇', Pcs: '台', Stick: '支', Grid: '格', Sheet: '片'
}
const TALK_STATUS: Record<string, TalkStatus> = {
  Draft: 'draft', Generated: 'generated', Published: 'published', Archived: 'archived'
}
const SECTION_TYPE: Record<string, TalkSectionType> = {
  Cover: 'cover', Catalog: 'catalog', Community: 'community', Requirement: 'requirement',
  SitePhoto: 'sitePhoto', Survey: 'survey', SurveyReport: 'surveyReport', OriginalPlan: 'originalPlan',
  Problem: 'problem', Demolition: 'demolition', Masonry: 'masonry', Optimization: 'optimization',
  RoomDesign: 'roomDesign', SoftDecor: 'softDecor', Material: 'material', Appliance: 'appliance',
  Investment: 'investment', Saving: 'saving', End: 'end'
}

const GENERATION_MODE: Record<string, DesignGenerationMode> = { Precise: 'precise', Concept: 'concept' }
const GENERATION_MODE_API: Record<DesignGenerationMode, string> = { precise: 'Precise', concept: 'Concept' }
const GENERATION_STATUS: Record<string, DesignGenerationStatus> = {
  ContextBuilding: 'contextBuilding', PromptReady: 'promptReady', Generating: 'generating',
  DraftReady: 'draftReady', DesignerConfirmed: 'designerConfirmed', Shared: 'shared',
  FeedbackReceived: 'feedbackReceived', Revised: 'revised', Locked: 'locked', Failed: 'failed'
}
const RENDER_STATUS: Record<string, DesignRenderStatus> = {
  Ready: 'ready', Confirmed: 'confirmed', Superseded: 'superseded', Failed: 'failed'
}

export function unitName(value: unknown): string {
  const raw = enumValue(value)
  return UNIT_NAMES[raw] || raw || '项'
}

export function unitValue(value: string): string {
  return UNIT_VALUES[value] || value || 'Item'
}

/** 区域取值来源（DEC-069）：measure=量房原始区域继承，override=方案内录入，templateReference=模版参考值。 */
function spaceValueOrigin(raw: unknown): 'measure' | 'override' | 'templateReference' | null {
  if (raw == null) return null
  const value = String(enumValue(raw)).toLowerCase()
  if (value === 'measure') return 'measure'
  if (value === 'override') return 'override'
  if (value === 'templatereference') return 'templateReference'
  return null
}

function normalizeSpace(raw: RawRecord): DesignSpace {
  return {
    ...raw,
    id: String(raw.id ?? raw.spaceId ?? ''),
    type: SPACE_TYPE[enumValue(raw.type)] || 'livingRoom',
    name: raw.name ?? '',
    length: raw.length == null ? undefined : number(raw.length),
    width: raw.width == null ? undefined : number(raw.width),
    height: raw.height == null ? undefined : number(raw.height),
    area: raw.area == null ? null : number(raw.area),
    perimeter: raw.perimeter == null ? null : number(raw.perimeter),
    areaSource: raw.areaSource == null ? null : (enumValue(raw.areaSource).toLowerCase() as 'measured' | 'estimated') || null,
    valueOrigin: spaceValueOrigin(raw.valueOrigin),
    sourceMeasureRegionId: raw.sourceMeasureRegionId == null ? undefined : String(raw.sourceMeasureRegionId),
    sort: number(raw.sort),
    remark: raw.remark,
    images: raw.images
  }
}

function normalizeDesignItem(raw: RawRecord): DesignItem {
  return {
    ...raw,
    id: String(raw.id ?? raw.itemId ?? ''),
    space: raw.space ? normalizeSpace(raw.space) : undefined,
    catalogItem: raw.catalogItem ? normalizeCatalogItem(raw.catalogItem) : undefined,
    constructionId: raw.construction ? String(raw.construction.constId ?? '') : undefined,
    materialId: raw.material ? String(raw.material.matId ?? '') : undefined,
    type: ITEM_TYPE[enumValue(raw.type)] || 'construction',
    category: raw.category ?? '',
    name: raw.name ?? '',
    brand: raw.brand,
    spec: raw.spec,
    unit: unitName(raw.unit),
    quantity: number(raw.quantity),
    pendingMeasure: raw.pendingMeasure == null
      ? String(raw.formula ?? '').startsWith('__PENDING_MEASURE__')
      : Boolean(raw.pendingMeasure),
    formulaRevisionNeeded: Boolean(raw.formulaRevisionNeeded),
    materialPrice: number(raw.materialPrice),
    manualPrice: number(raw.manualPrice),
    costPrice: raw.costPrice === undefined || raw.costPrice === null ? null : number(raw.costPrice),
    pricingMode: PRICING_MODE[enumValue(raw.pricingMode)] || 'materialAndManual',
    amount: number(raw.amount),
    cost: number(raw.cost),
    formula: raw.formula,
    criterion: raw.criterion,
    craft: raw.craft,
    remark: raw.remark,
    sort: number(raw.sort),
    images: raw.images
  }
}

export function normalizeRequirement(raw: RawRecord): DesignRequirement {
  return {
    ...raw,
    id: String(raw.id ?? raw.requirementId ?? ''),
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    type: raw.type ? SPACE_TYPE[enumValue(raw.type)] : undefined,
    spaceName: raw.spaceName,
    kind: REQUIREMENT_KIND[enumValue(raw.kind)] || 'demand',
    category: REQUIREMENT_CATEGORY[enumValue(raw.category)] || 'other',
    priority: REQUIREMENT_PRIORITY[enumValue(raw.priority)] || 'medium',
    status: REQUIREMENT_STATUS[enumValue(raw.status)] || 'pending',
    title: raw.title ?? '',
    detail: raw.detail,
    response: raw.response,
    source: raw.source,
    confirmedAt: dateTimeValue(raw.confirmedAt)
  }
}

export function normalizeScheme(raw: RawRecord): DesignScheme {
  return {
    ...raw,
    id: String(raw.id ?? raw.designId ?? ''),
    no: raw.no ?? '',
    name: raw.name ?? '',
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    version: number(raw.version),
    style: raw.style,
    status: DESIGN_STATUS[enumValue(raw.status)] || 'draft',
    area: number(raw.area),
    layout: raw.layout,
    description: raw.description,
    coverUrl: raw.coverUrl,
    cadUrl: raw.cadUrl,
    originalPlanUrl: raw.originalPlanUrl,
    originalPlanImages: raw.originalPlanImages,
    demolitionUrl: raw.demolitionUrl,
    masonryUrl: raw.masonryUrl,
    optimizationUrl: raw.optimizationUrl,
    sitePhotos: raw.sitePhotos,
    surveyPhotos: raw.surveyPhotos,
    spaces: raw.spaces ? (raw.spaces as RawRecord[]).map(normalizeSpace) : undefined,
    items: raw.items ? (raw.items as RawRecord[]).map(normalizeDesignItem) : undefined,
    requirements: raw.requirements ? (raw.requirements as RawRecord[]).map(normalizeRequirement) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

async function signScheme(raw: RawRecord): Promise<DesignScheme> {
  const scheme = normalizeScheme(raw)
  if (!scheme.id) return scheme
  const documentPaths = [
    scheme.coverUrl, scheme.cadUrl, scheme.originalPlanUrl, scheme.demolitionUrl,
    scheme.masonryUrl, scheme.optimizationUrl
  ].filter((path): path is string => !!path)
  const sitePaths = scheme.sitePhotos || []
  const surveyPaths = scheme.surveyPhotos || []
  const originalPlanPaths = scheme.originalPlanImages || []
  const spacePaths = (scheme.spaces || []).flatMap((space) => space.images || [])
  const itemPaths = (scheme.items || []).flatMap((item) => item.images || [])
  const signed = await fileApi.grant('Design', scheme.id, [
    ...documentPaths, ...sitePaths, ...surveyPaths, ...originalPlanPaths, ...spacePaths, ...itemPaths
  ])
  let index = 0
  const next = (): string | undefined => signed[index++]
  return {
    ...scheme,
    coverUrl: scheme.coverUrl ? next() : undefined,
    cadUrl: scheme.cadUrl ? next() : undefined,
    originalPlanUrl: scheme.originalPlanUrl ? next() : undefined,
    demolitionUrl: scheme.demolitionUrl ? next() : undefined,
    masonryUrl: scheme.masonryUrl ? next() : undefined,
    optimizationUrl: scheme.optimizationUrl ? next() : undefined,
    sitePhotos: (scheme.sitePhotos || []).map(() => next() || ''),
    surveyPhotos: (scheme.surveyPhotos || []).map(() => next() || ''),
    originalPlanImages: (scheme.originalPlanImages || []).map(() => next() || ''),
    spaces: scheme.spaces?.map((space) => ({
      ...space,
      images: (space.images || []).map(() => next() || '')
    })),
    items: scheme.items?.map((item) => ({
      ...item,
      images: (item.images || []).map(() => next() || '')
    }))
  }
}

function normalizeSection(raw: RawRecord): TalkSection {
  return {
    ...raw,
    id: String(raw.id ?? raw.sectionId ?? ''),
    type: SECTION_TYPE[enumValue(raw.type)] || 'catalog',
    title: raw.title ?? '',
    subtitle: raw.subtitle,
    content: raw.content,
    images: raw.images,
    sort: number(raw.sort),
    visible: raw.visible !== false
  }
}

function normalizeTalkQuote(raw: RawRecord): Quote {
  return {
    ...raw,
    id: String(raw.id ?? raw.quoteId ?? ''),
    no: raw.no ?? '',
    title: raw.title,
    version: number(raw.version || 1),
    area: number(raw.area),
    subtotal: number(raw.subtotal),
    amount: number(raw.amount),
    cost: number(raw.cost),
    discount: number(raw.discount || 1),
    taxAmount: number(raw.taxAmount),
    mode: ({ Package: 'package', Custom: 'custom', Hybrid: 'hybrid' } as const)[raw.mode as 'Package' | 'Custom' | 'Hybrid'] || 'custom',
    status: (raw.status || 'draft').toString().toLowerCase() as Quote['status'],
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export function normalizeTalk(raw: RawRecord): TalkPlan {
  return {
    ...raw,
    id: String(raw.id ?? raw.talkId ?? ''),
    no: raw.no ?? '',
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    design: raw.design ? normalizeScheme(raw.design) : undefined,
    quote: raw.quote ? normalizeTalkQuote(raw.quote) : undefined,
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    title: raw.title ?? '',
    version: number(raw.version),
    status: TALK_STATUS[enumValue(raw.status)] || 'draft',
    coverUrl: raw.coverUrl,
    outputUrl: raw.outputUrl,
    description: raw.description,
    builtAt: dateTimeValue(raw.builtAt),
    sections: raw.sections ? (raw.sections as RawRecord[]).map(normalizeSection) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

async function signTalk(raw: RawRecord): Promise<TalkPlan> {
  const talk = normalizeTalk(raw)
  if (!talk.id) return talk
  const paths = [
    ...(talk.coverUrl ? [talk.coverUrl] : []),
    ...(talk.outputUrl ? [talk.outputUrl] : []),
    ...(talk.sections || []).flatMap((section) => section.images || [])
  ]
  const signed = await fileApi.grant('Talk', talk.id, paths)
  let index = 0
  return {
    ...talk,
    coverUrl: talk.coverUrl ? signed[index++] : undefined,
    outputUrl: talk.outputUrl ? signed[index++] : undefined,
    sections: talk.sections?.map((section) => ({
      ...section,
      images: (section.images || []).map(() => signed[index++] || '')
    }))
  }
}

function normalizeContextSnapshot(raw: RawRecord): DesignContextSnapshot {
  return {
    id: String(raw.id ?? raw.snapshotId ?? ''),
    contextJson: raw.contextJson,
    missingFieldsJson: raw.missingFieldsJson,
    conflictFlagsJson: raw.conflictFlagsJson,
    confidence: raw.confidence || 'Low',
    capturedAt: dateTimeValue(raw.capturedAt)
  }
}

function normalizePromptSnapshot(raw: RawRecord): DesignPromptSnapshot {
  return {
    id: String(raw.id ?? raw.promptId ?? ''),
    visualPrompt: raw.visualPrompt,
    talkPrompt: raw.talkPrompt ?? undefined,
    documentBriefJson: raw.documentBriefJson,
    templateVersion: raw.templateVersion,
    renderedAt: dateTimeValue(raw.renderedAt)
  }
}

function normalizeRenderVersion(raw: RawRecord): DesignRenderVersion {
  return {
    id: String(raw.id ?? raw.renderId ?? ''),
    sequence: number(raw.sequence || 1),
    status: RENDER_STATUS[enumValue(raw.status)] || 'ready',
    imageUrl: raw.imageUrl,
    deliverable: raw.deliverable === true,
    confirmedBy: raw.confirmedBy ? normalizeEmployee(raw.confirmedBy) : undefined,
    confirmedAt: dateTimeValue(raw.confirmedAt),
    startedAt: dateTimeValue(raw.startedAt),
    completedAt: dateTimeValue(raw.completedAt)
  }
}

export function normalizeGenerationTask(raw: RawRecord): DesignGenerationTask {
  return {
    id: String(raw.id ?? raw.generationId ?? ''),
    no: raw.no ?? '',
    design: raw.design ? normalizeScheme(raw.design) : undefined,
    customer: raw.customer ? normalizeCustomer(raw.customer) : undefined,
    property: raw.property ? normalizeProperty(raw.property) : undefined,
    owner: raw.owner ? normalizeEmployee(raw.owner) : undefined,
    mode: GENERATION_MODE[enumValue(raw.mode)] || 'concept',
    status: GENERATION_STATUS[enumValue(raw.status)] || 'contextBuilding',
    failureCode: raw.failureCode,
    builtAt: dateTimeValue(raw.builtAt),
    completedAt: dateTimeValue(raw.completedAt),
    selectedRender: raw.selectedRender ? normalizeRenderVersion(raw.selectedRender) : undefined,
    contextSnapshot: raw.contextSnapshot ? normalizeContextSnapshot(raw.contextSnapshot) : undefined,
    promptSnapshot: raw.promptSnapshot ? normalizePromptSnapshot(raw.promptSnapshot) : undefined,
    renderVersions: raw.renderVersions ? (raw.renderVersions as RawRecord[]).map(normalizeRenderVersion) : undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime),
    updatedAt: dateTimeValue(raw.updatedAt ?? raw.updateTime?.dateTime ?? raw.updateTime)
  }
}

export interface RequirementInput {
  requirementId?: string
  customerId: string
  propertyId?: string
  type?: SpaceType
  spaceName?: string
  kind: RequirementKind
  category: RequirementCategory
  priority: RequirementPriority
  title: string
  detail?: string
  response?: string
  source?: string
}

export interface SchemeInput {
  customerId?: string
  propertyId?: string
  designId?: string
  /** 局部更新时可省略：后端对未提交字段保持原值 */
  name?: string
  style?: string
  layout?: string
  description?: string
  coverUrl?: string
  cadUrl?: string
  originalPlanUrl?: string
  sitePhotos?: string[]
  originalPlanImages?: string[]
  surveyPhotos?: string[]
  demolitionUrl?: string
  masonryUrl?: string
  optimizationUrl?: string
}

export interface SpaceInput {
  designId: string
  spaceId?: string
  type: SpaceType
  name: string
  /** 量房快照长/宽/层高（m）：只记录现场粗测，不用于推算面积与周长。 */
  length?: number
  width?: number
  height?: number
  /** 实测面积（㎡）：设计师按 CAD 录入，必填且 > 0（DEC-062）。 */
  area?: number
  /** 实测周长（m）：设计师按 CAD 录入，必填且 > 0。 */
  perimeter?: number
  sort?: number
  remark?: string
}

export interface DesignItemInput {
  designId: string
  itemId?: string
  spaceId?: string
  type: DesignItemType
  category: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity: number
  materialPrice: number
  manualPrice: number
  /** null = 成本待维护，0 = 明确零成本 */
  costPrice: number | null
  pricingMode: PricingMode
  criterion?: string
  remark?: string
  sort?: number
  catalogItemId?: string
  constructionId?: string
  materialId?: string
}

async function signGenerationTask(raw: RawRecord): Promise<DesignGenerationTask> {
  const task = normalizeGenerationTask(raw)
  const designId = task.design?.id
  if (!designId) return task
  const all = [...(task.renderVersions || []), ...(task.selectedRender ? [task.selectedRender] : [])]
  const paths = Array.from(new Set(all.map((item) => item.imageUrl).filter((item): item is string => !!item)))
  if (!paths.length) return task
  const signed = await fileApi.grant('Design', designId, paths)
  const signedByPath = new Map(paths.map((path, index) => [path, signed[index] || path]))
  const signVersion = (item: DesignRenderVersion): DesignRenderVersion => ({
    ...item,
    imageUrl: item.imageUrl ? signedByPath.get(item.imageUrl) || item.imageUrl : item.imageUrl
  })
  return {
    ...task,
    selectedRender: task.selectedRender ? signVersion(task.selectedRender) : undefined,
    renderVersions: task.renderVersions?.map(signVersion)
  }
}

export const designApi = {
  requirements: async (customerId: string, propertyId?: string) =>
    listOf(await post<PageResult<RawRecord> | RawRecord[]>('design/requirement/page', {
      customerId, propertyId, current: 1, size: 100
    })).map(normalizeRequirement),

  saveRequirement: (input: RequirementInput) =>
    post<RawRecord>('design/requirement/save', {
      requirementId: input.requirementId,
      customerId: input.customerId,
      propertyId: input.propertyId,
      targetPropertyId: input.propertyId,
      type: input.type ? SPACE_TYPE_API[input.type] : undefined,
      spaceName: input.spaceName,
      kind: REQUIREMENT_KIND_API[input.kind],
      category: REQUIREMENT_CATEGORY_API[input.category],
      priority: REQUIREMENT_PRIORITY_API[input.priority],
      title: input.title,
      detail: input.detail,
      response: input.response,
      source: input.source
    }).then(normalizeRequirement),

  schemes: async (customerId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('design/scheme/page', {
      customerId, current: 1, size: 100
    })).map(signScheme)),

  scheme: (designId: string) =>
    post<RawRecord>('design/scheme/info', { designId }).then(signScheme),

  saveScheme: (input: SchemeInput) =>
    post<RawRecord>(input.designId ? 'design/scheme/update' : 'design/scheme/save', {
      designId: input.designId,
      customerId: input.customerId,
      propertyId: input.propertyId,
      targetPropertyId: input.propertyId,
      name: input.name,
      style: input.style,
      layout: input.layout,
      description: input.description,
      coverUrl: fileApi.storagePath(input.coverUrl),
      cadUrl: fileApi.storagePath(input.cadUrl),
      originalPlanUrl: fileApi.storagePath(input.originalPlanUrl),
      sitePhotos: (input.sitePhotos || []).map((item: string) => fileApi.storagePath(item)),
      originalPlanImages: (input.originalPlanImages || []).map((item: string) => fileApi.storagePath(item)),
      surveyPhotos: (input.surveyPhotos || []).map((item: string) => fileApi.storagePath(item)),
      demolitionUrl: fileApi.storagePath(input.demolitionUrl),
      masonryUrl: fileApi.storagePath(input.masonryUrl),
      optimizationUrl: fileApi.storagePath(input.optimizationUrl)
    }).then(signScheme),

  copyScheme: (designId: string, customerId: string, propertyId?: string) =>
    post<RawRecord>('design/scheme/save', {
      copyFromId: designId,
      customerId,
      propertyId
    }).then(signScheme),

  deleteScheme: (designId: string) =>
    post<RawRecord>('design/scheme/delete', { designId }).then(signScheme),

  buildScheme: (designId: string, status: DesignStatus) =>
    post<RawRecord>('design/scheme/build', { designId, status: DESIGN_STATUS_API[status] }).then(signScheme),

  deleteSpace: (spaceId: string) =>
    post<RawRecord>('design/space/delete', { spaceId }).then(normalizeSpace),

  saveSpace: (input: SpaceInput) =>
    post<RawRecord>('design/space/save', {
      designId: input.designId,
      spaceId: input.spaceId,
      type: SPACE_TYPE_API[input.type],
      name: input.name,
      length: input.length,
      width: input.width,
      height: input.height,
      area: input.area,
      perimeter: input.perimeter,
      sort: input.sort,
      remark: input.remark
    }).then(normalizeSpace),

  deleteItem: (itemId: string) =>
    post<RawRecord>('design/item/delete', { itemId }).then(normalizeDesignItem),

  saveItem: (input: DesignItemInput) =>
    post<RawRecord>('design/item/save', {
      designId: input.designId,
      itemId: input.itemId,
      spaceId: input.spaceId,
      catalogItemId: input.catalogItemId,
      constructionId: input.constructionId,
      materialId: input.materialId,
      type: ITEM_TYPE_API[input.type],
      category: input.category,
      name: input.name,
      brand: input.brand,
      spec: input.spec,
      unit: unitValue(input.unit),
      quantity: input.quantity,
      materialPrice: input.materialPrice,
      manualPrice: input.manualPrice,
      costPrice: input.costPrice,
      pricingMode: PRICING_MODE_API[input.pricingMode],
      criterion: input.criterion,
      remark: input.remark,
      sort: input.sort
    }).then(normalizeDesignItem),

  buildGeneration: (designId: string, mode: DesignGenerationMode = 'precise') =>
    post<RawRecord>('design/generation/build', {
      designId,
      mode: GENERATION_MODE_API[mode]
    }).then(signGenerationTask),

  generationInfo: (generationId: string) =>
    post<RawRecord>('design/generation/info', { generationId }).then(signGenerationTask),

  generations: async (designId: string, size = 5) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('design/generation/page', {
      designId, current: 1, size
    })).map(signGenerationTask)),

  confirmGeneration: (generationId: string, renderId: string, spaceId?: string) =>
    post<RawRecord>('design/generation/update', {
      generationId, renderId, spaceId
    }).then(signGenerationTask),

  talks: async (designId: string) =>
    Promise.all(listOf(await post<PageResult<RawRecord> | RawRecord[]>('design/talk/page', {
      designId, current: 1, size: 20
    })).map(signTalk)),

  buildTalk: (designId: string, quoteId?: string, talkId?: string) =>
    post<RawRecord>('design/talk/build', { designId, quoteId, talkId }).then(signTalk),

  talk: (talkId: string) =>
    post<RawRecord>('design/talk/info', { talkId }).then(signTalk)
}

export const designMeta = {
  spaceType: {
    bedroom: '卧室', kitchen: '厨房', livingRoom: '客厅', diningRoom: '餐厅',
    bathroom: '卫生间', balcony: '阳台'
  } as Record<SpaceType, string>,
  itemType: {
    general: '综合', construction: '施工', material: '主材',
    custom: '全屋定制', appliance: '电器', soft: '软装家具'
  } as Record<DesignItemType, string>,
  designStatus: {
    draft: '设计中', ready: '待谈单', presented: '已讲解', selected: '已选中', archived: '已归档'
  } as Record<DesignStatus, string>,
  requirementKind: { demand: '诉求', reject: '排斥点' } as Record<RequirementKind, string>,
  requirementPriority: { high: '高', medium: '中', low: '低' } as Record<RequirementPriority, string>,
  categoryOptions: ['拆除', '水电', '瓦工', '木工', '油漆', '瓷砖', '木门', '卫浴', '地板', '橱柜', '灯具', '软装', '其他'],
  unitOptions: ['㎡', 'm', '项', '个', '处', '套', '樘', '台', '只', '米'],
  pricingMode: {
    materialAndManual: '材料+人工', materialOnly: '仅材料', manualOnly: '仅人工', fixedTotal: '固定总价'
  } as Record<PricingMode, string>
}
