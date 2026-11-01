/** 设计模版（方案库）领域模型：字段与 OBJ-005 / BR-040 对齐。 */
import type { DesignItemType } from '@/domains/design/model'

export type TemplateScope = 'Personal' | 'Store' | 'Company'
export type TemplateStatus = 'Draft' | 'Published' | 'Disabled'

export interface TemplateVersion {
  versionId: string
  version: number
  status: TemplateStatus
  name: string
  houseType: string
  areaMin?: number
  areaMax?: number
  tags?: string
  publishedAt?: string
}

export interface TemplateRoom {
  roomId?: string
  roomKey: string
  name: string
  roomType: string
  sortNo: number
  length?: number
  width?: number
  height?: number
  doorWidthTotal?: number
  doorAreaTotal?: number
  windowAreaTotal?: number
  wallRise?: number
  referenceArea?: number
  referencePerimeter?: number
  count: number
  remark?: string
}

export interface TemplateItem {
  itemId: string
  roomKey?: string
  quantityFormula?: string
  defaultQuantity?: number
  sortNo: number
  remark?: string
  catalogItem?: {
    itemId: string
    type?: DesignItemType
    name: string
    unit: string
    pricingMode: string
  }
}

export interface DesignTemplate {
  templateId: string
  scope: TemplateScope
  status: TemplateStatus
  currentVersion?: TemplateVersion
  sourceTemplate?: { templateId: string }
  owner?: { empId: string; name: string }
  remark?: string
  rooms?: TemplateRoom[]
  items?: TemplateItem[]
  roomCount?: number
  itemCount?: number
  usageCount?: number
  updateTime?: string
}

export interface TemplatePage {
  content: DesignTemplate[]
  totalElements: number
}

export const TEMPLATE_SCOPE_LABELS: Record<TemplateScope, string> = {
  Personal: '个人',
  Store: '门店',
  Company: '企业'
}

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  Draft: '草稿',
  Published: '已发布',
  Disabled: '已停用'
}
