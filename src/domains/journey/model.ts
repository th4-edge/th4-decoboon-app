import type { QuoteGroup } from '@/domains/trade/model'
export interface JourneyFact {
  key: string
  label: string
  value: string
  valueType: string
}

export interface JourneyAction {
  key: string
  type: string
  title: string
  description: string
  targetType: string
  targetId?: string
}

export interface JourneySection {
  key: string
  title: string
  subtitle: string
  status?: string
  statusName?: string
  summary: string
  facts: JourneyFact[]
  actions: JourneyAction[]
  items: JourneyItem[]
}


export interface JourneyMedia {
  key: string
  url: string
  /** Photo 现场照片 / Structure 原始结构 / Cad CAD图 / Render 效果图 / Original 原始 / Demolition 拆改 / Masonry 砌筑 / Optimization 优化 / SitePhoto / SurveyPhoto */
  kind: string
  title: string
  time?: string
  room?: string
}

export interface JourneyRegion {
  key: string
  name: string
  type?: string
  length?: string
  width?: string
  height?: string
  /** 实测面积（㎡）；未录入为空。 */
  area?: string
  /** 实测周长（m）；未录入为空。 */
  perimeter?: string
  /** 面积口径来源：实测 / 估算（历史推算值，仅作参考）。 */
  areaSource?: string
  itemCount: number
  images: string[]
  remark?: string
}

export interface JourneyPriceRow {
  key: string
  name: string
  category?: string
  brand?: string
  spec?: string
  unit?: string
  quantity?: string
  price?: string
  amount?: string
  role?: string
  type?: string
  /** 施工工艺：来自材料库主数据 CatalogItem.craft */
  craft?: string
  /** 工艺/验收标准：来自 CatalogItem.criterion，设计分项快照兜底 */
  criterion?: string
}

export interface JourneyPriceGroup {
  key: string
  name: string
  total?: string
  summary?: string
  rows: JourneyPriceRow[]
}

export interface JourneyItem {
  key: string
  title: string
  subtitle?: string
  status?: string
  statusName?: string
  amount?: string
  date?: string
  businessType?: string
  businessId?: string
  images: string[]
  lines: string[]
  facts: JourneyFact[]
  media: JourneyMedia[]
  regions: JourneyRegion[]
  priceGroups: JourneyPriceGroup[]
  regionGroups: QuoteGroup[]
  typeGroups: QuoteGroup[]
  /** 服务端是否拿到了原始报价行；用于区分“空报价”和“分组暂不可确认”。 */
  hasSourceLines: boolean
}

export interface CustomerJourney {
  projectId: string
  projectNo?: string
  projectName: string
  projectStatus?: string
  projectStatusName?: string
  progress: number
  currentStageName?: string
  propertyAddress?: string
  asOf?: string
  sections: JourneySection[]
  actions: JourneyAction[]
  openFeedbackCount: number
  pendingActionCount: number
  /** 服务方品牌与署名配置（叙事主体归装企，ANS-BIZ-20261010-004 §4） */
  vendor?: JourneyVendor
  /** 为这一户服务的人（只含姓名与岗位，不含个人手机号） */
  team?: JourneyMember[]
  /** 仅员工侧业主视角预览返回；真实业主端为空。 */
  previewMeta?: OwnerPreviewMeta
}

/** 员工侧业主视角只读预览标识。 */
export interface OwnerPreviewMeta {
  mode: 'EmployeeOwnerPreview'
  readOnly: boolean
  notice: string
  watermark?: string
  asOf?: string
}

/** 亲友只读视图（免登录）。服务端已脱敏：不含房号、姓名、电话；Friend 范围不含金额。 */
export interface ShareJourneyView {
  projectName?: string
  /** 小区 + 楼栋，不含房号 */
  community?: string
  progress?: number
  currentStageName?: string
  photos?: string[]
  vendor?: JourneyVendor
  asOf?: string
}

/** 服务人员投影。硬边界：不得含员工个人手机号（USER-DECISION-20261014-002）。 */
export interface JourneyMember {
  name: string
  roleName: string
}

export interface JourneyVendor {
  name?: string
  logo?: string
  color?: string
  /** 是否显示「记录存证与保管 · 装得清」署名，默认关闭 */
  custodianCredit?: boolean
  /** 服务区域 */
  serviceArea?: string
  /** 企业统一客服电话（非员工个人号码） */
  serviceTel?: string
  /** 售后专线 */
  afterSaleTel?: string
  /** 资质 */
  qualification?: string
  /** 一句话简介 */
  intro?: string
}
