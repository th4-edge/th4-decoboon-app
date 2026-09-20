import type { TaskNodeKey, TaskPriority, TaskStatus } from './model'
import { TOKEN_COLOR } from '@/styles/tokens'

export const TASK_STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo:     { label: '待办',     color: '#86909C' },
  doing:    { label: '进行中',   color: TOKEN_COLOR.primaryBase },
  accepting:{ label: '待验收',   color: '#FF7D00' },
  done:     { label: '已完成',   color: '#00B42A' },
  overdue:  { label: '已逾期',   color: '#F53F3F' }
}

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: '低', color: '#86909C' },
  normal: { label: '中', color: '#13C2C2' },
  high:   { label: '高', color: '#FF7D00' },
  urgent: { label: '紧急', color: '#F53F3F' }
}

export const NODE_META: Record<TaskNodeKey, { label: string; color: string; tip: string }> = {
  start:   { label: '施工进行', color: '#13C2C2', tip: '任务开工，PM 拍照/视频确认' },
  conceal: { label: '隐蔽工程', color: '#FF7D00', tip: '覆盖前验收，PM 拍照/视频留证' },
  finish:  { label: '施工完成', color: '#00B42A', tip: '完工自检，PM 拍照/视频确认' }
}
