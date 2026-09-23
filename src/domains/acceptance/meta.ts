import type { AcceptResult } from './model'
import { STATUS_COLOR } from '@/styles/tokens'

export const ACCEPT_RESULT_META: Record<AcceptResult, { label: string; color: string }> = {
  pass:    { label: '验收通过', color: STATUS_COLOR.done },
  rectify: { label: '整改后验收', color: STATUS_COLOR.pending },
  reject:  { label: '验收不通过', color: STATUS_COLOR.blocked }
}
