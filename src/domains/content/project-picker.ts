import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Project } from '@/domains/project/model'

/** 内容素材上传页选择项目后，通过一次性存储把结果交还给来源页。 */
export const CONTENT_PROJECT_PICKER_KEY = 'content_project_picker_result'

export interface ContentProjectSelection {
  id: string
  name: string
  no?: string
  customerId?: string
  customerName?: string
  address?: string
  community?: string
  status?: string
  businessOrigin?: string
  designerName?: string
  managerName?: string
  currentStageName?: string
}

export type ContentProjectPickerResult = PickerResult<ContentProjectSelection>

function isProjectSelection(value: unknown): value is ContentProjectSelection {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<ContentProjectSelection>
  return Boolean(project.id && project.name)
}

const channel = createPickerChannel<ContentProjectSelection>(CONTENT_PROJECT_PICKER_KEY, isProjectSelection)

export function setContentProjectPickerResult(result: ContentProjectPickerResult) {
  channel.set(result)
}

export function consumeContentProjectPickerResult(): ContentProjectPickerResult | null {
  return channel.consume()
}

/** 选择器只回传识别摘要，来源页仍应以 projectId 重新读取权威项目。 */
export function toContentProjectSelection(project: Project): ContentProjectSelection {
  return {
    id: project.id,
    name: project.name,
    no: project.no,
    customerId: project.customer?.id,
    customerName: project.customer?.name,
    address: project.address,
    community: project.community,
    status: project.status,
    businessOrigin: project.businessOrigin,
    designerName: project.designer?.name,
    managerName: project.manager?.name,
    currentStageName: project.currentStageName
  }
}
