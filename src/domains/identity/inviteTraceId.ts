/** 生成可跨页面关联的邀请追踪号；不包含手机号、姓名等个人信息。 */
export function createInviteTraceId(inviteId?: string, source = 'direct'): string {
  const invitePart = String(inviteId || 'unknown').replace(/[^0-9A-Za-z]/g, '').slice(-10) || 'unknown'
  const sourcePart = source.replace(/[^0-9A-Za-z_]/g, '_').slice(0, 12) || 'direct'
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${sourcePart}_${invitePart}_${Date.now().toString(36)}_${randomPart}`
}
