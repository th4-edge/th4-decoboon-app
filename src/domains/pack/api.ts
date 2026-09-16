import { listOf, post } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import { dateTimeValue } from '@/core/format'
import type { PackageTemplate } from './model'

type RawRecord = Record<string, any>

function normalizeTemplate(raw: RawRecord): PackageTemplate {
  return {
    id: String(raw.id ?? raw.templateId ?? ''),
    name: raw.name ?? '',
    area: Number(raw.area ?? 0),
    price: Number(raw.price ?? 0),
    discount: Number(raw.discount ?? 1),
    cost: Number(raw.cost ?? 0),
    criterions: raw.criterions,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export const packApi = {
  templates: async () => listOf(await post<PageResult<RawRecord> | RawRecord[]>('pack/template/page', {
    current: 1,
    size: 100
  })).map(normalizeTemplate)
}
