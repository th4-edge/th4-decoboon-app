export type CatalogType = 'construction' | 'material' | 'soft' | 'appliance' | 'general' | 'custom'
export type CatalogPricingMode = 'materialAndManual' | 'materialOnly' | 'manualOnly' | 'fixedTotal'

export interface CatalogItem {
  id: string
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
