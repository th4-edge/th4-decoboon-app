import type { CatalogItem, CatalogPricingMode, CatalogType } from '@/domains/catalog/model'

export interface PackageSection {
  id: string
  name: string
  spaceTypes?: string[]
  maxDeleteNum: number
  priority: number
}

export interface PackageLine {
  id: string
  name: string
  brand?: string
  spec?: string
  unit: string
  quantity?: string
  quantityFactor: number
  pricingMethod: CatalogPricingMode
  included: boolean
  deductible: boolean
  sort: number
  catalogType?: CatalogType
  sectionNameSnapshot?: string
  criterions?: string[]
  item?: CatalogItem
  section?: PackageSection
}

export interface PackageTemplateItem {
  id: string
  name: string
  unit: string
  spaceTypes?: string[]
  priority: number
}

export type PackageTemplateStatus = 'Draft' | 'Published' | 'Disabled'

export interface PackageTemplate {
  id: string
  code?: string
  version: number
  /** 旧后端无生命周期字段时保持未知，不用 Draft 伪造。 */
  status?: PackageTemplateStatus
  statusKnown?: boolean
  currentPublished: boolean
  publishedAt?: string
  snapshotHash?: string
  sectionCount?: number
  lineCount?: number
  ready?: boolean
  name: string
  area: number
  price: number
  discount: number
  cost: number
  criterions?: string[]
  items?: PackageLine[]
  /** 选择器摘要：服务端批量聚合，不依赖逐套餐加载明细。 */
  itemCount?: number
  typeCounts?: Partial<Record<CatalogType, number>>
  sectionTypeCounts?: Record<string, Partial<Record<CatalogType, number>>>
  sectionLineCounts?: Record<string, number>
  referenceAmount?: number
  referenceCost?: number
  typeReferenceAmounts?: Partial<Record<CatalogType, number>>
  sectionReferenceAmounts?: Record<string, number>
  sectionTypeReferenceAmounts?: Record<string, Partial<Record<CatalogType, number>>>
  measures?: Record<string, { price: number; standard: number; remark?: string }>
  createdAt?: string
  updatedAt?: string
}

export interface PackageTemplateInput {
  templateId?: string
  name: string
  area: number
  price: number
  discount: number
  criterions?: string[]
}

export interface PackageSectionInput {
  groupId?: string
  name: string
  spaceTypes?: string[]
  maxDeleteNum?: number
  priority?: number
}

export interface PackageLineInput {
  itemId?: string
  templateId: string
  sectionId: string
  catalogItemId: string
  name?: string
  brand?: string
  spec?: string
  unit?: string
  quantity?: string
  quantityFactor?: number
  pricingMethod?: CatalogPricingMode
  included?: boolean
  deductible?: boolean
  sort?: number
  criterions?: string[]
}
