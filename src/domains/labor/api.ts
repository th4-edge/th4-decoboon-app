import { post, listOf } from '@/core/http'
import { dateTimeValue } from '@/core/format'
import { toPageData, type PageData, type PageResult } from '@/domains/common/model'
import type { Worker, WorkerStatus } from './model'

type Raw = Record<string, any>
const STATUS_API: Record<WorkerStatus, string> = { active: 'Active', disabled: 'Disabled' }
const STATUS_UI: Record<string, WorkerStatus> = { active: 'active', disabled: 'disabled' }

function lower(raw: unknown) { return String(raw ?? '').toLowerCase() }

export function normalizeWorker(raw: Raw): Worker {
  return {
    id: String(raw.id ?? raw.workerId ?? ''),
    name: raw.name ?? '',
    idCardNo: raw.idCardNo ?? undefined,
    trade: raw.trade ?? undefined,
    phone: raw.phone ?? undefined,
    bankName: raw.bankName ?? undefined,
    bankAccount: raw.bankAccount ?? undefined,
    status: STATUS_UI[lower(raw.status)] || 'active',
    remark: raw.remark ?? undefined,
    createdAt: dateTimeValue(raw.createdAt ?? raw.createTime?.dateTime ?? raw.createTime)
  }
}

export const laborApi = {
  /** 工人档案分页：服务端已按角色裁剪身份证号与银行账号。 */
  workers: async (params: { keyword?: string; status?: WorkerStatus; current?: number; size?: number } = {}) =>
    (await laborApi.workerPickerPage(params)).list,

  workerPickerPage: async (params: { keyword?: string; status?: WorkerStatus; current?: number; size?: number } = {}): Promise<PageData<Worker>> => {
    const current = params.current ?? 1
    const size = params.size ?? 20
    const result = await post<PageResult<Raw> | Raw[]>('labor/worker/page', {
      current,
      size,
      keyword: params.keyword?.trim() || undefined,
      status: params.status ? STATUS_API[params.status] : undefined
    })
    const page = toPageData(result, current, size)
    return { ...page, list: page.list.map(normalizeWorker) }
  },

  /** 工人详情：按主键单条读取，避免列表分页导致编辑页取不到人。 */
  worker: async (id: string) => normalizeWorker(await post<Raw>('labor/worker/info', { workerId: id })),

  saveWorker: async (input: {
    name: string; idCardNo?: string; trade?: string; phone?: string
    bankName?: string; bankAccount?: string; remark?: string
  }) => normalizeWorker(await post<Raw>('labor/worker/save', input)),

  updateWorker: async (input: {
    id: string; name?: string; idCardNo?: string; trade?: string; phone?: string
    bankName?: string; bankAccount?: string; status?: WorkerStatus; remark?: string
  }) => normalizeWorker(await post<Raw>('labor/worker/update', {
    workerId: input.id,
    name: input.name,
    idCardNo: input.idCardNo,
    trade: input.trade,
    phone: input.phone,
    bankName: input.bankName,
    bankAccount: input.bankAccount,
    status: input.status ? STATUS_API[input.status] : undefined,
    remark: input.remark
  }))
}
