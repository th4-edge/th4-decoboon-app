import { post, absoluteUrl } from '@/core/http'
import { runtime } from '@/config'
import type { DocumentArchive } from './model'

type RawRecord = Record<string, unknown>

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function normalize(raw: RawRecord): DocumentArchive {
  return {
    documentId: String(raw.documentId ?? raw.id ?? ''),
    type: valueOf(raw.type),
    audience: valueOf(raw.audience),
    businessNo: String(raw.businessNo ?? ''),
    templateVersion: Number(raw.templateVersion ?? 0),
    path: String(raw.path ?? ''),
    sha256: String(raw.sha256 ?? ''),
    fileName: String(raw.fileName ?? ''),
    contentType: String(raw.contentType ?? 'application/pdf'),
    size: Number(raw.size ?? 0),
    generatedAt: raw.generatedAt ? String(raw.generatedAt) : undefined,
    status: valueOf(raw.status),
    url: absoluteUrl(String(raw.url ?? '')),
    urlExpiresAt: raw.urlExpiresAt ? String(raw.urlExpiresAt) : undefined
  }
}

export const documentApi = {
  buildQuote: async (quoteId: string): Promise<DocumentArchive> =>
    normalize(await post<RawRecord>('document/quote/build', { quoteId })),

  quoteRecords: async (quoteId: string): Promise<DocumentArchive[]> => {
    const result = await post<RawRecord[]>('document/record/page', { quoteId })
    return Array.isArray(result) ? result.map(normalize) : []
  },

  buildContract: async (contractId: string): Promise<DocumentArchive> =>
    normalize(await post<RawRecord>('document/contract/build', { contractId })),

  contractRecords: async (contractId: string): Promise<DocumentArchive[]> => {
    const result = await post<RawRecord[]>('document/contract/records', { contractId })
    return Array.isArray(result) ? result.map(normalize) : []
  },

  reprint: async (documentId: string, reason: string): Promise<DocumentArchive> =>
    normalize(await post<RawRecord>('document/reprint/save', { documentId, reason }))
}

export interface DocumentLayoutBlockInfo {
  key: string
  visible: boolean
  sort: number
}

export interface VoucherDesignerElement {
  id: string
  type: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  zIndex?: number
  binding?: string
  fixedText?: string
  style?: Record<string, unknown>
  border?: Record<string, unknown>
}

export interface VoucherDesignerTable {
  id: string
  binding: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  headerRepeat: boolean
  rowsPerPage: number
  rowHeightMm: number
  columns: Array<{ key: string; label: string; widthMm: number; align?: string }>
}

export interface VoucherDesignerConfig {
  schemaVersion: number
  page: { widthMm: number; heightMm: number; orientation: 'portrait' | 'landscape'; marginMm: number; gridSizeMm: number }
  elements: VoucherDesignerElement[]
  tables: VoucherDesignerTable[]
  print: { scale: number; offsetXMm: number; offsetYMm: number }
}

export interface DocumentLayoutConfig {
  pageSize: 'A3' | 'A4' | 'A5'
  orientation: 'portrait' | 'landscape'
  marginMm: number
  blocks: DocumentLayoutBlockInfo[]
  signatures: string[]
  footer?: string
}

export interface DocumentTemplateVersionInfo {
  versionId: string
  version: number
  name: string
  presetCode?: string
  status: string
  publishedAt?: string
  createdAt?: string
}

export interface DocumentTemplateInfo {
  templateId?: string
  type: string
  scope: string
  name: string
  version: number
  fieldConfig: Record<string, boolean>
  styleConfig: { primaryColor: string; fontSize: number; rowSpacing: number }
  /** 平台预设编码与适用说明，仅基线库返回。 */
  presetCode?: string
  presetNote?: string
  publishedVersion?: number
  publishedAt?: string
  layoutConfig?: DocumentLayoutConfig
  designerConfig?: VoucherDesignerConfig
}

const DEFAULT_LAYOUT_BLOCKS = [
  { key: 'company', visible: true, sort: 10 },
  { key: 'title', visible: true, sort: 20 },
  { key: 'meta', visible: true, sort: 30 },
  { key: 'amount', visible: true, sort: 40 },
  { key: 'detail', visible: true, sort: 50 },
  { key: 'sign', visible: true, sort: 60 },
  { key: 'footer', visible: true, sort: 70 }
]

function layoutOf(raw: unknown): DocumentLayoutConfig {
  const source = raw && typeof raw === 'object' ? raw as RawRecord : {}
  const blocks = Array.isArray(source.blocks)
    ? source.blocks.map((item) => item && typeof item === 'object' ? item as RawRecord : {}).map((item) => ({
        key: String(item.key ?? ''),
        visible: item.visible == null ? true : Boolean(item.visible),
        sort: Number(item.sort ?? 10)
      })).filter((item) => item.key)
    : DEFAULT_LAYOUT_BLOCKS
  return {
    pageSize: ['A3', 'A4', 'A5'].includes(String(source.pageSize)) ? String(source.pageSize) as 'A3' | 'A4' | 'A5' : 'A4',
    orientation: source.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginMm: Number(source.marginMm ?? 12),
    blocks: blocks.length ? blocks : DEFAULT_LAYOUT_BLOCKS,
    signatures: Array.isArray(source.signatures) ? source.signatures.map(String) : ['制单', '审核', '领款/付款人'],
    footer: source.footer == null ? undefined : String(source.footer)
  }
}

export const DEFAULT_DESIGNER_CONFIG: VoucherDesignerConfig = {
  schemaVersion: 1,
  page: { widthMm: 210, heightMm: 297, orientation: 'portrait', marginMm: 12, gridSizeMm: 5 },
  elements: [],
  tables: [],
  print: { scale: 100, offsetXMm: 0, offsetYMm: 0 }
}

function designerOf(raw: unknown): VoucherDesignerConfig {
  const source = raw && typeof raw === 'object' ? raw as RawRecord : {}
  if (!Object.keys(source).length) return JSON.parse(JSON.stringify(DEFAULT_DESIGNER_CONFIG))
  const page = source.page && typeof source.page === 'object' ? source.page as RawRecord : {}
  const print = source.print && typeof source.print === 'object' ? source.print as RawRecord : {}
  return {
    schemaVersion: Number(source.schemaVersion ?? 1),
    page: {
      widthMm: Number(page.widthMm ?? 210),
      heightMm: Number(page.heightMm ?? 297),
      orientation: page.orientation === 'landscape' ? 'landscape' : 'portrait',
      marginMm: Number(page.marginMm ?? 12),
      gridSizeMm: Number(page.gridSizeMm ?? 5)
    },
    elements: Array.isArray(source.elements) ? source.elements as VoucherDesignerElement[] : [],
    tables: Array.isArray(source.tables) ? source.tables as VoucherDesignerTable[] : [],
    print: { scale: Number(print.scale ?? 100), offsetXMm: Number(print.offsetXMm ?? 0), offsetYMm: Number(print.offsetYMm ?? 0) }
  }
}

function versionOf(raw: RawRecord): DocumentTemplateVersionInfo {
  return {
    versionId: String(raw.versionId ?? ''),
    version: Number(raw.version ?? 0),
    name: String(raw.name ?? ''),
    presetCode: raw.presetCode == null ? undefined : String(raw.presetCode),
    status: String(raw.status ?? ''),
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : undefined,
    createdAt: raw.createTime ? String(raw.createTime) : undefined
  }
}

function templateOf(raw: RawRecord): DocumentTemplateInfo {
  const fieldConfig = typeof raw.fieldConfig === 'string' ? safeJson(raw.fieldConfig, {}) : (raw.fieldConfig || {})
  const styleRaw = typeof raw.styleConfig === 'string' ? safeJson(raw.styleConfig, {}) : (raw.styleConfig || {})
  const style = styleRaw as Record<string, unknown>
  return {
    templateId: raw.templateId == null ? undefined : String(raw.templateId),
    type: valueOf(raw.type),
    scope: valueOf(raw.scope),
    name: String(raw.name ?? ''),
    version: Number(raw.version ?? 1),
    fieldConfig: fieldConfig as Record<string, boolean>,
    styleConfig: {
      primaryColor: String(style.primaryColor ?? '#0E8A7D'),
      fontSize: Number(style.fontSize ?? 12),
      rowSpacing: Number(style.rowSpacing ?? 2)
    },
    presetCode: raw.presetCode == null ? undefined : String(raw.presetCode),
    presetNote: raw.presetNote == null ? undefined : String(raw.presetNote),
    publishedVersion: Number(raw.publishedVersion ?? 0),
    publishedAt: raw.publishedAt ? String(raw.publishedAt) : undefined,
    layoutConfig: layoutOf(raw.layoutConfig),
    designerConfig: designerOf(raw.designerConfig)
  }
}

function safeJson(text: string, fallback: unknown): unknown {
  try { return JSON.parse(text) } catch { return fallback }
}

export const templateApi = {
  /** 单据模板列表：无企业模板时返回平台行业基线。 */
  templates: async (): Promise<DocumentTemplateInfo[]> => {
    const result = await post<RawRecord[]>('document/template/page', {})
    return Array.isArray(result) ? result.map(templateOf) : []
  },
  /** 平台常用凭证模板库：企业可一键套用后改名保存。 */
  presets: async (): Promise<DocumentTemplateInfo[]> => {
    const result = await post<RawRecord[]>('document/baseline/list', {})
    return Array.isArray(result) ? result.map(templateOf) : []
  },
  /** 保存企业模板（企业负责人、店长、财务可保存，服务端逐键校验字段与样式）。 */
  saveTemplate: async (input: { type: string; presetCode?: string; name: string; fieldConfig: Record<string, boolean>; styleConfig: DocumentTemplateInfo['styleConfig']; layoutConfig?: DocumentLayoutConfig; designerConfig?: VoucherDesignerConfig }) =>
    templateOf(await post<RawRecord>('document/template/save', {
      type: input.type,
      presetCode: input.presetCode,
      name: input.name,
      fieldConfig: JSON.stringify(input.fieldConfig),
      styleConfig: JSON.stringify(input.styleConfig),
      layoutConfig: JSON.stringify(input.layoutConfig ?? layoutOf(undefined)),
      designerConfig: JSON.stringify(input.designerConfig ?? DEFAULT_DESIGNER_CONFIG)
    })),

  publishTemplate: async (templateId: string) =>
    templateOf(await post<RawRecord>('document/template/publish', { templateId })),

  disableTemplate: async (templateId: string) =>
    templateOf(await post<RawRecord>('document/template/disable', { templateId })),

  templateVersions: async (templateId: string): Promise<DocumentTemplateVersionInfo[]> => {
    const result = await post<RawRecord[]>('document/template-version/page', { templateId })
    return Array.isArray(result) ? result.map(versionOf) : []
  }
}
