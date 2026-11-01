import { computed } from 'vue'
import { session } from '@/domains/identity/session'
import { buildBrandTheme, serializeBrandTheme } from '@/styles/brand-theme'

/** 企业品牌主题跟随当前登录企业；未登录、无配置或值非法时回退平台主色。 */
export function useBrandTheme() {
  const brandTheme = computed(() => buildBrandTheme(session.company?.color))
  const brandThemeStyle = computed(() => serializeBrandTheme(brandTheme.value))
  return { brandTheme, brandThemeStyle }
}
