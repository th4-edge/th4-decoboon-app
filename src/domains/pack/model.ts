import type { CatalogItem, CatalogPricingMode } from '@/domains/catalog/model'

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
  status: PackageTemplateStatus
  currentPublished: boolean
  publishedAt?: string
  snapshotHash?: string
  name: string
  area: number
  price: number
  discount: number
  cost: number
  criterions?: string[]
  items?: PackageLine[]
  /** 选择器摘要：服务端批量聚合，不依赖逐套餐加载明细。 */
  itemCount?: number
  sectionCount?: number
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
