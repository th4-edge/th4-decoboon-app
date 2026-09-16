export type CatalogType = 'construction' | 'material' | 'soft' | 'appliance' | 'general' | 'custom'
export type CatalogPricingMode = 'materialAndManual' | 'materialOnly' | 'manualOnly' | 'fixedTotal'

export interface CatalogItem {
  id: string
  /** 类型特有明细（由后端按 type 落库到对应明细表） */
  durationDays?: number
  lossRate?: number
  minimumOrder?: number
  leadTimeDays?: number
  warrantyMonths?: number
  board?: string
  countertop?: string
  type: CatalogType
  code?: string
  category: string
  brand?: string
  series?: string
  spec?: string
  name: string
  unit: string
  pricingMode: CatalogPricingMode
  materialPrice: number
  manualPrice: number
  costPrice: number
  formula: string
  craft?: string
  criterion?: string
  description?: string
  images?: string[]
  active: boolean
  sort: number
  maintainer?: { id: string; name: string }
  updatedAt?: string
}

export interface CatalogTree {
  type: CatalogType
  categories: string[]
  brands: Record<string, string[]>
  specs: Record<string, string[]>
  total: number
}
