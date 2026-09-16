import type { AcceptResult } from './model'

export const ACCEPT_RESULT_META: Record<AcceptResult, { label: string; color: string }> = {
  pass:    { label: '验收通过', color: '#00B42A' },
  rectify: { label: '整改后验收', color: '#FF7D00' },
  reject:  { label: '验收不通过', color: '#F53F3F' }
}
