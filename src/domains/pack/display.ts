import type { CatalogItem, CatalogType } from '@/domains/catalog/model'
import { moneyExact } from '@/core/format'

export const PACKAGE_ITEM_TYPES: Array<{ value: CatalogType; label: string }> = [
  { value: 'construction', label: '施工' },
  { value: 'material', label: '主材' },
  { value: 'custom', label: '定制' },
  { value: 'soft', label: '软装' },
  { value: 'appliance', label: '电器' },
  { value: 'general', label: '综合' }
]

export function packageItemTypeLabel(type?: CatalogType): string {
  return PACKAGE_ITEM_TYPES.find((item) => item.value === type)?.label || '其他'
}

export interface CatalogPricePart {
  label: string
  amount: string
}

export function catalogPriceParts(item?: CatalogItem): CatalogPricePart[] {
  if (!item) return []
  if (item.pricingMode === 'fixedTotal') {
    return item.fixedTotalPrice === undefined ? [] : [{ label: '固定总价', amount: moneyExact(item.fixedTotalPrice) }]
  }
  if (item.pricingMode === 'materialOnly') {
    return item.materialPrice > 0 ? [{ label: '材料', amount: moneyExact(item.materialPrice) }] : []
  }
  if (item.pricingMode === 'manualOnly') {
    return item.manualPrice > 0 ? [{ label: '人工', amount: moneyExact(item.manualPrice) }] : []
  }
  const result: CatalogPricePart[] = []
  if (item.materialPrice > 0) result.push({ label: '材料', amount: moneyExact(item.materialPrice) })
  if (item.manualPrice > 0) result.push({ label: '人工', amount: moneyExact(item.manualPrice) })
  return result
}
