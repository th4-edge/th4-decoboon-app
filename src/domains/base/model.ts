export interface StageTemplate {
  id: string
  name: string
  sort: number
  weight: number
  color?: string
}

export interface Zone {
  id: string
  name: string
  sort: number
  icon?: string
}

/** 工艺/施工项主数据，项目任务只保存被选择后的业务快照。 */
export interface CraftTask {
  id: string
  code: string
  name: string
  category: string
  defaultStageId: string
  zoneIds: string[]
  craft: string
  spec: string
  unit: string
  conceal: boolean
  sort: number
}

/** 主材主数据最小选项，供设计分项引用。 */
export interface MaterialOption {
  id: string
  name: string
  category: string
  unit: string
  brand?: string
  spec?: string
  materialPrice: number
  manualPrice: number
  /** null = 成本待维护，0 = 明确零成本 */
  costPrice: number | null
}

export interface GiftPack {
  id: string
  name: string
  area: number
  price: number
  discount: number
  cost: number
  criteria?: string[]
}
