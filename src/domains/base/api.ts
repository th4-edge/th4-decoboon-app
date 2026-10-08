import { catalogApi } from '@/domains/catalog/api'
import { packApi } from '@/domains/pack/api'
import type { GiftPack, MaterialOption, Zone } from './model'

/**
 * 施工区域来自后端 SpaceType 枚举。
 * id 使用后端枚举值，任务保存时由 ProjectTask Save Provider 的 resolveZone 统一解析。
 */
const SPACE_TYPES: Zone[] = [
  { id: 'Bedroom', name: '卧室', sort: 10, icon: 'bed' },
  { id: 'Kitchen', name: '厨房', sort: 20, icon: 'cooking-pot' },
  { id: 'LivingRoom', name: '客厅', sort: 30, icon: 'sofa' },
  { id: 'DiningRoom', name: '餐厅', sort: 40, icon: 'table' },
  { id: 'Bathroom', name: '卫生间', sort: 50, icon: 'shower' },
  { id: 'Balcony', name: '阳台', sort: 60, icon: 'sun' }
]

const ZONE_IDS = SPACE_TYPES.map((item) => item.id)

function isConceal(name: string, code: string): boolean {
  const text = `${name} ${code}`.toLowerCase()
  return ['隐蔽', '水电', '防水', '布线', '管路', '龙骨'].some((keyword) => text.includes(keyword))
}

export const baseApi = {
  /** 区域是后端稳定枚举，不在前端维护可持久化主数据。 */
  zones: async (): Promise<Zone[]> => SPACE_TYPES.map((item) => ({ ...item })),

  /** 主材选择同样直接消费 catalog/item/page。 */
  materials: async (keyword?: string): Promise<MaterialOption[]> => {
    const result = await catalogApi.page({
      type: 'material',
      keyword,
      current: 1,
      size: 100
    })
    return result.list.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      brand: item.brand,
      spec: item.spec,
      materialPrice: item.materialPrice,
      manualPrice: item.manualPrice,
      costPrice: item.costPrice
    }))
  },

  /** 礼包模板直接复用 pack/template/page。 */
  giftPacks: async (): Promise<GiftPack[]> => {
    const templates = await packApi.templates()
    return templates.map((item) => ({
      id: item.id,
      name: item.name,
      area: item.area,
      price: item.price,
      discount: item.discount,
      cost: item.cost,
      criteria: item.criterions
    }))
  }
}
