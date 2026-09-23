export type WorkerStatus = 'active' | 'disabled'

/** 个人工人档案：企业级共享主数据，作为个人工资凭证的对方来源。 */
export interface Worker {
  id: string
  name: string
  idCardNo?: string
  trade?: string
  phone?: string
  bankName?: string
  bankAccount?: string
  status: WorkerStatus
  remark?: string
  createdAt?: string
}
