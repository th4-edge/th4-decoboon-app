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
    presetNote: raw.presetNote == null ? undefined : String(raw.presetNote)
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
  saveTemplate: async (input: { type: string; name: string; fieldConfig: Record<string, boolean>; styleConfig: DocumentTemplateInfo['styleConfig'] }) =>
    templateOf(await post<RawRecord>('document/template/save', {
      type: input.type,
      name: input.name,
      fieldConfig: JSON.stringify(input.fieldConfig),
      styleConfig: JSON.stringify(input.styleConfig)
    }))
}
