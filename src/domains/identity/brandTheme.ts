import { computed, reactive } from 'vue'

/**
 * 装企品牌主题：Company.color 是唯一运行时输入，其他品牌色阶全部派生。
 * 成功、警告、危险、业务状态色不参与换肤，避免品牌色覆盖语义。
 */
export const DEFAULT_BRAND_COLOR = '#16A394'

export interface BrandTheme {
  source: string
  primary: string
  primaryBase: string
  primaryLight: string
  primaryDark: string
  primaryDeep: string
  primaryLighter: string
  primaryLightest: string
  ink: string
  inkDeep: string
  onPrimary: string
  gradient: string
  gradientSoft: string
  focusShadow: string
}

function normalizeHex(input?: string): string {
  const value = String(input || '').trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (!match) return DEFAULT_BRAND_COLOR
  const hex = match[1].length === 3
    ? match[1].split('').map((part) => part + part).join('')
    : match[1]
  return `#${hex.toUpperCase()}`
}

export function isValidBrandColor(input?: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(input || '').trim())
}

function mixHex(source: string, target: string, targetWeight: number): string {
  const parse = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  const a = parse(normalizeHex(source))
  const b = parse(normalizeHex(target))
  const weight = Math.max(0, Math.min(1, targetWeight))
  return `#${a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight)
    .toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function channel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const values = [1, 3, 5].map((start) => parseInt(normalizeHex(hex).slice(start, start + 2), 16))
    return 0.2126 * channel(values[0]) + 0.7152 * channel(values[1]) + 0.0722 * channel(values[2])
  }
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function accessibleAction(base: string): string {
  let candidate = base
  for (let step = 0; step <= 60 && contrastRatio(candidate, '#FFFFFF') < 4.5; step += 5) {
    candidate = mixHex(base, '#000000', step / 100)
  }
  return candidate
}

function alpha(hex: string, value: number): string {
  const values = [1, 3, 5].map((start) => parseInt(normalizeHex(hex).slice(start, start + 2), 16))
  return `rgba(${values.join(', ')}, ${value})`
}

export function deriveBrandTheme(color?: string): BrandTheme {
  const base = isValidBrandColor(color) ? normalizeHex(color) : DEFAULT_BRAND_COLOR
  const action = accessibleAction(base)
  const primaryDark = action
  const onPrimary = contrastRatio(action, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#17212B'
  const p50 = mixHex(base, '#FFFFFF', 0.94)
  const p100 = mixHex(base, '#FFFFFF', 0.86)
  const p200 = mixHex(base, '#FFFFFF', 0.72)
  const p300 = mixHex(base, '#FFFFFF', 0.55)
  const p400 = mixHex(base, '#FFFFFF', 0.28)
  const p600 = mixHex(base, '#000000', 0.14)
  const p700 = mixHex(base, '#000000', 0.40)
  const p800 = mixHex(base, '#000000', 0.43)
  const p900 = mixHex(base, '#000000', 0.58)
  return {
    source: base,
    primary: action,
    primaryBase: base,
    primaryLight: p400,
    primaryDark,
    primaryDeep: p700,
    primaryLighter: p100,
    primaryLightest: p50,
    ink: p900,
    inkDeep: p800,
    onPrimary,
    gradient: `linear-gradient(135deg, ${action} 0%, ${base} 52%, ${p700} 100%)`,
    gradientSoft: `linear-gradient(145deg, ${alpha(base, 0.14)} 0%, ${alpha(base, 0.04)} 100%)`,
    focusShadow: `0 0 0 4rpx ${alpha(base, 0.16)}`
  }
}

export const activeBrandTheme = reactive(deriveBrandTheme())

function applyPlatformChrome(theme: BrandTheme): void {
  if (typeof uni === 'undefined') return
  try {
    uni.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme.primary,
      animation: { duration: 200, timingFunc: 'easeIn' }
    })
  } catch {
    // 自定义页头不依赖原生导航栏，失败不阻断业务。
  }
  // App 使用自定义 JzTabBar，pages.json 未声明原生 tabBar；调用 setTabBarStyle 会在任意页面报
  // “not TabBar page”。自定义 TabBar 已由 Token/CSS Variables 跟随主题，无需调用原生 API。
}

export function applyBrandTheme(color?: string): BrandTheme {
  const theme = deriveBrandTheme(color)
  Object.assign(activeBrandTheme, theme)
  if (typeof document !== 'undefined') {
    brandThemeVariables(theme).split(';').forEach((entry) => {
      const index = entry.indexOf(':')
      if (index <= 0) return
      document.documentElement.style.setProperty(entry.slice(0, index), entry.slice(index + 1))
    })
  }
  applyPlatformChrome(theme)
  return theme
}

export function brandThemeVariables(theme: BrandTheme = activeBrandTheme): string {
  return [
    `--jzb-primary:${theme.primary}`,
    `--jzb-primary-base:${theme.primaryBase}`,
    `--jzb-primary-light:${theme.primaryLight}`,
    `--jzb-primary-dark:${theme.primaryDark}`,
    `--jzb-primary-deep:${theme.primaryDeep}`,
    `--jzb-primary-lighter:${theme.primaryLighter}`,
    `--jzb-primary-lightest:${theme.primaryLightest}`,
    `--jzb-brand-ink:${theme.ink}`,
    `--jzb-brand-ink-deep:${theme.inkDeep}`,
    `--jzb-text-on-brand:${theme.onPrimary}`,
    `--jzb-gradient:${theme.gradient}`,
    `--jzb-gradient-soft:${theme.gradientSoft}`,
    `--jzb-focus-shadow:${theme.focusShadow}`,
    `--jzb-primary-a08:${alpha(theme.primaryBase, 0.08)}`,
    `--jzb-primary-a10:${alpha(theme.primaryBase, 0.10)}`,
    `--jzb-primary-a12:${alpha(theme.primaryBase, 0.12)}`,
    `--jzb-primary-a14:${alpha(theme.primaryBase, 0.14)}`,
    `--jzb-primary-a16:${alpha(theme.primaryBase, 0.16)}`,
    `--jzb-primary-a18:${alpha(theme.primaryBase, 0.18)}`,
    `--jzb-primary-a20:${alpha(theme.primaryBase, 0.20)}`,
    `--jzb-primary-a22:${alpha(theme.primaryBase, 0.22)}`,
    `--jzb-primary-a24:${alpha(theme.primaryBase, 0.24)}`,
    `--jzb-primary-a26:${alpha(theme.primaryBase, 0.26)}`,
    `--jzb-primary-a28:${alpha(theme.primaryBase, 0.28)}`,
    `--jzb-primary-a30:${alpha(theme.primaryBase, 0.30)}`,
    `--jzb-primary-a34:${alpha(theme.primaryBase, 0.34)}`,
    `--jzb-primary-a35:${alpha(theme.primaryBase, 0.35)}`,
    `--jzb-primary-a50:${alpha(theme.primaryBase, 0.50)}`,
    `--jzb-primary-a55:${alpha(theme.primaryBase, 0.55)}`,
    `--jzb-shadow-float:0 16rpx 38rpx ${alpha(theme.primary, 0.24)}`
  ].join(';')
}

export const brandPageStyle = computed(() => brandThemeVariables())
