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
  /** 固定总价（仅 fixedTotal 计价方式使用，独立于材料/人工单价） */
  fixedTotalPrice?: number
  /** 标准成本：null = 成本待维护，0 = 明确零成本 */
  costPrice: number | null
  /** 来源：手工维护 / 批量导入 / 服务迁移 */
  sourceType?: 'Manual' | 'Import' | 'Migration'
  /** 导入来源批次 */
  importBatchId?: string
  formula: string
  craft?: string
  criterion?: string
  description?: string
  images?: string[]
  active: boolean
  sort: number
  revision: number
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

export type CatalogRevisionType = 'Create' | 'Update' | 'Disable' | 'Enable' | 'Delete'

/** 报价项目不可变修订记录；无成本权限时 snapshotJson 由后端裁剪。 */
export interface CatalogRevision {
  id: string
  revision: number
  changeType: CatalogRevisionType
  itemCode?: string
  snapshotJson?: string
  snapshotHash?: string
  changedBy?: { id: string; name: string }
  changedAt?: string
}

export type CatalogImportStatus =
  | 'Uploaded' | 'Parsed' | 'PendingConfirm' | 'Importing'
  | 'Imported' | 'PartiallyImported' | 'Failed' | 'Expired' | 'Revoked'

export type CatalogImportRowStatus =
  | 'Ready' | 'Duplicate' | 'SuspectedDuplicate' | 'Error' | 'Imported' | 'Skipped'

/** 报价项目库导入批次（PRD 批次字段） */
export interface CatalogImportBatch {
  id: string
  batchNo: string
  status: CatalogImportStatus
  templateVersion: string
  validationVersion?: string
  originalFilename?: string
  contentType?: string
  fileSize?: number
  fileSha256?: string
  duplicatePolicy?: 'Skip' | 'Import'
  totalRows: number
  readyRows: number
  duplicateRows: number
  suspectedDuplicateRows: number
  errorRows: number
  costPendingRows: number
  importedRows: number
  skippedRows: number
  partialImport?: boolean
  expireAt?: string
  parsedAt?: string
  confirmedAt?: string
  finishedAt?: string
  revokedAt?: string
  message?: string
  createdBy?: { id: string; name: string }
  createdAt?: string
}

/** 报价项目库导入行（预览、重复项、疑似重复与错误清单） */
export interface CatalogImportRow {
  id: string
  rowNo: number
  status: CatalogImportRowStatus
  errorField?: string
  errorCode?: string
  errorReason?: string
  itemName?: string
  itemType?: CatalogType
  unit?: string
  pricingMode?: CatalogPricingMode
  saleAmount?: number
  costPending?: boolean
  itemId?: string
  itemCode?: string
}
