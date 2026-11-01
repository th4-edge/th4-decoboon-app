import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Project } from './model'

export const REPORT_PROJECT_PICKER_KEY = 'project_report_project_picker_result'

export interface ReportProjectSelection {
  id: string
  name: string
  status: Project['status']
  statusName: string
  address: string
  customerName?: string
  stageName?: string
  managerName?: string
  designerName?: string
}

export type ReportProjectPickerResult = PickerResult<ReportProjectSelection>

function valid(value: unknown): value is ReportProjectSelection {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<ReportProjectSelection>
  return Boolean(project.id && project.name && project.status)
}

const channel = createPickerChannel<ReportProjectSelection>(REPORT_PROJECT_PICKER_KEY, valid)

export function setReportProjectPickerResult(result: ReportProjectPickerResult) {
  channel.set(result)
}

export function consumeReportProjectPickerResult(): ReportProjectPickerResult | null {
  return channel.consume()
}

export function toReportProjectSelection(project: Project): ReportProjectSelection {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    statusName: PROJECT_STATUS_LABEL[project.status],
    address: project.address || project.property?.address || project.customer?.community || '地址待完善',
    customerName: project.customer?.name,
    stageName: project.currentStageName,
    managerName: project.manager?.name,
    designerName: project.designer?.name
  }
}

const PROJECT_STATUS_LABEL: Record<Project['status'], string> = {
  preparing: '待开工',
  ongoing: '施工中',
  suspended: '已停工',
  accepting: '待验收',
  finished: '已完工',
  settled: '已结算'
}
