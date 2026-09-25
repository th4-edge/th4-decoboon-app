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
  length?: number
  width?: number
  height?: number
  area: number
  perimeter: number
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
  materialPrice: number
  manualPrice: number
  /** null = 成本待维护，0 = 明确零成本 */
  costPrice: number | null
  pricingMode: PricingMode
  amount: number
  cost: number
  formula?: string
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
