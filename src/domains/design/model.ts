import type { Customer } from '../crm/model'
import type { Property } from '@/domains/property/model'
import type { Employee } from '@/domains/identity/model'
import type { CatalogItem } from '../catalog/model'
import type { Quote } from '../trade/model'

export type RequirementKind = 'demand' | 'reject'
export type RequirementCategory = 'function' | 'style' | 'material' | 'budget' | 'schedule' | 'quality' | 'other'
export type RequirementPriority = 'high' | 'medium' | 'low'
export type RequirementStatus = 'pending' | 'confirmed' | 'resolved'
export type DesignStatus = 'draft' | 'ready' | 'presented' | 'selected' | 'archived'
export type SpaceType = 'bedroom' | 'kitchen' | 'livingRoom' | 'diningRoom' | 'bathroom' | 'balcony'
export type DesignItemType = 'general' | 'construction' | 'material' | 'custom' | 'appliance' | 'soft'
export type PricingMode = 'materialAndManual' | 'materialOnly' | 'manualOnly' | 'fixedTotal'
export type TalkStatus = 'draft' | 'generated' | 'published' | 'archived'
export type TalkSectionType =
  | 'cover' | 'catalog' | 'community' | 'requirement' | 'sitePhoto' | 'survey' | 'surveyReport'
  | 'originalPlan' | 'problem' | 'demolition' | 'masonry' | 'optimization' | 'roomDesign'
  | 'softDecor' | 'material' | 'appliance' | 'investment' | 'saving' | 'end'

export interface DesignRequirement {
  id: string
  customer?: Customer
  property?: Property
  owner?: Employee
  type?: SpaceType
  spaceName?: string
  kind: RequirementKind
  category: RequirementCategory
  priority: RequirementPriority
  status: RequirementStatus
  title: string
  detail?: string
  response?: string
  source?: string
  confirmedAt?: string
}

export interface DesignSpace {
  id: string
  type: SpaceType
  name: string
  /** 量房快照：现场粗测长/宽/层高，只作记录与偏差参考，不是工程量依据（DEC-062）。 */
  length?: number
  width?: number
  height?: number
  /** 实测面积（㎡）：设计师实测量房后按 CAD 录入；未录入为 null（不是 0）。 */
  area: number | null
  /** 实测周长（m）：未录入为 null。 */
  perimeter: number | null
  /** 面积口径来源：measured=实测（可作工程量基数）；estimated=历史估算/模版参考（仅提示复核，不进金额）。 */
  areaSource?: 'measured' | 'estimated' | null
  /**
   * 区域取值来源（DEC-069）：
   * measure=继承量房原始区域（结构起点）；override=方案内录入/改造；templateReference=模版参考值（待实测，不进金额）。
   */
  valueOrigin?: 'measure' | 'override' | 'templateReference' | null
  /** 来源量房原始区域（仅来源标识，方案与量房原始区域不联动）。 */
  sourceMeasureRegionId?: string
  sort: number
  remark?: string
  images?: string[]
}

export interface DesignItem {
  id: string
  space?: DesignSpace
  type: DesignItemType
  category: string
  catalogItem?: CatalogItem
  constructionId?: string
  materialId?: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity: number
  /** 实例化或重算时实测尺寸未录入：quantity=0 表示「待补」，与「0=赠送」由服务端标记区分（DEC-058）。 */
  pendingMeasure?: boolean
  /** 历史中文公式等非专业变量公式：不参与重算、保留既有工程量，待修订（GAP-042）。 */
  formulaRevisionNeeded?: boolean
  materialPrice: number
  manualPrice: number
  /** null = 成本待维护，0 = 明确零成本 */
  costPrice: number | null
  pricingMode: PricingMode
  amount: number
  cost: number
  /** 报价项目库计价说明快照，例如「(材料单价) × 工程量」。 */
  formula?: string
  /** 工程量自动计算公式，只允许 A/P/WP/CP 等专业变量。 */
  quantityFormula?: string
  criterion?: string
  /** 施工工艺快照：设计分项生成时从材料库 CatalogItem.craft 冻结 */
  craft?: string
  remark?: string
  sort: number
  images?: string[]
}

export interface DesignScheme {
  id: string
  no: string
  name: string
  customer?: Customer
  property?: Property
  owner?: Employee
  version: number
  style?: string
  status: DesignStatus
  area: number
  layout?: string
  description?: string
  coverUrl?: string
  cadUrl?: string
  cadPreviewUrl?: string
  cadConvertStatus?: 'pending' | 'processing' | 'success' | 'failed'
  originalPlanUrl?: string
  originalPlanImages?: string[]
  demolitionUrl?: string
  masonryUrl?: string
  optimizationUrl?: string
  sitePhotos?: string[]
  surveyPhotos?: string[]
  spaces?: DesignSpace[]
  items?: DesignItem[]
  requirements?: DesignRequirement[]
  createdAt?: string
  updatedAt?: string
}


export type DesignGenerationMode = 'precise' | 'concept'
export type DesignGenerationStatus =
  | 'contextBuilding' | 'promptReady' | 'generating' | 'draftReady'
  | 'designerConfirmed' | 'shared' | 'feedbackReceived' | 'revised' | 'locked' | 'failed'
export type DesignRenderStatus = 'ready' | 'confirmed' | 'superseded' | 'failed'

export interface DesignContextSnapshot {
  id: string
  contextJson?: string
  missingFieldsJson?: string
  conflictFlagsJson?: string
  confidence: 'High' | 'Medium' | 'Low' | string
  capturedAt?: string
}

export interface DesignPromptSnapshot {
  id: string
  visualPrompt?: string
  /** 仅 Designer 返回。 */
  talkPrompt?: string
  documentBriefJson?: string
  templateVersion?: string
  renderedAt?: string
}

export interface DesignRenderVersion {
  id: string
  sequence: number
  status: DesignRenderStatus
  imageUrl?: string
  deliverable: boolean
  confirmedBy?: Employee
  confirmedAt?: string
  startedAt?: string
  completedAt?: string
}

export interface DesignGenerationTask {
  id: string
  no: string
  design?: DesignScheme
  customer?: Customer
  property?: Property
  owner?: Employee
  mode: DesignGenerationMode
  status: DesignGenerationStatus
  failureCode?: string
  builtAt?: string
  completedAt?: string
  selectedRender?: DesignRenderVersion
  contextSnapshot?: DesignContextSnapshot
  promptSnapshot?: DesignPromptSnapshot
  renderVersions?: DesignRenderVersion[]
  createdAt?: string
  updatedAt?: string
}

export interface TalkSection {
  id: string
  type: TalkSectionType
  title: string
  subtitle?: string
  content?: string
  images?: string[]
  sort: number
  visible: boolean
}

export interface TalkPlan {
  id: string
  no: string
  customer?: Customer
  property?: Property
  design?: DesignScheme
  quote?: Quote
  owner?: Employee
  title: string
  version: number
  status: TalkStatus
  coverUrl?: string
  outputUrl?: string
  description?: string
  builtAt?: string
  sections?: TalkSection[]
  createdAt?: string
}
