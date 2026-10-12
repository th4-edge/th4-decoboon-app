export type PropertyStatus = 'pendingMeasure' | 'measuring' | 'measured' | 'designing' | 'quoted' | 'contracted' | 'serving' | 'completed'

export interface Property {
  id: string
  propertyNo: string
  customerId: string
  community?: string
  building?: string
  roomNo?: string
  address: string
  area: number
  layout?: string
  status: PropertyStatus
  salesman?: import('@/domains/identity/model').Employee
  designer?: import('@/domains/identity/model').Employee
  latestMeasureAt?: string
  remark?: string
  createdAt?: string
}

export interface Measure {
  id: string
  propertyId: string
  designer?: import('@/domains/identity/model').Employee
  measureTime?: string
  scheduledAt?: string
  completedAt?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  sitePhotos?: string[]
  originalStructure?: string
  dimensions?: string
  customerRequirements?: string
  designerConclusion?: string
  createdAt?: string
}

/** 区域类型（与后端 SpaceType 对齐）。 */
export type SpaceTypeName = 'bedroom' | 'kitchen' | 'livingRoom' | 'diningRoom' | 'bathroom' | 'balcony'

/**
 * 量房原始区域（DEC-069 / OBJ-007）。
 *
 * 量房测的是房屋**原始结构**：布局与区域基本固定，原始区域挂在**量房单**下，量房完成后**冻结**
 * （需要修正必须重新量房/复尺）。设计方案实例化时继承它作结构起点，二者**不联动**：
 * 装修设计会破坏结构（砌墙隔出卧室、砸墙打通客厅），设计后结构与原始结构不同是常态。
 */
export interface MeasureRegion {
  id: string
  roomKey?: string
  type: SpaceTypeName
  name: string
  /** 量房快照 长/宽/层高（m）：只作记录，不用于推算面积与周长（DEC-062）。 */
  length?: number
  width?: number
  height?: number
  /** 原始结构实测面积（㎡）/ 实测周长（m）：未录入为 null。 */
  area: number | null
  perimeter: number | null
  /** measured=实测（可作工程量基数）；estimated=估算（仅提示复核）。 */
  areaSource?: 'measured' | 'estimated' | null
  measuredAt?: string
  sort?: number
  remark?: string
}
