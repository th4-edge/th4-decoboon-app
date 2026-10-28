import { computed } from 'vue'
import { P } from '@/config'
import { session } from '@/domains/identity/session'
import { toast } from '@/composables/toast'

/** TeamLeader 页面只有在绑定团队后才能形成有效数据范围；Team 冻结后仍保留历史兼容。 */
export function useTeamContext() {
  const missingTeam = computed(() => session.role === 'teamLeader' && !session.emp?.team?.id)

  function requireTeam(): boolean {
    if (!missingTeam.value) return true
    toast('当前账号未绑定团队，请联系店长或企业负责人')
    uni.reLaunch({ url: P.home })
    return false
  }

  return { missingTeam, requireTeam }
}
