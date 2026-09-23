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
