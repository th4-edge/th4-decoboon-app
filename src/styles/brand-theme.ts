/**
 * 企业品牌运行时主题。
 *
 * 事实源：Company.color。这里只把企业填写的主色转换为稳定的视觉派生值，
 * 不把计算后的色板回写数据库，也不让品牌色覆盖成功、警告、风险等业务状态色。
 */
import { TOKEN_COLOR } from './tokens'

export interface BrandTheme {
  /** 原始有效输入；无效或未配置时为平台默认色。 */
  input: string
  primary: string
  primaryDark: string
  primaryDeep: string
  primaryLight: string
  primaryLighter: string
  primaryLightest: string
  border: string
  shadow: string
  gradient: string
  gradientSoft: string
}

export interface BrandColorPreset {
  label: string
  value: string
}

type Rgb = { r: number; g: number; b: number }

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const MIN_WHITE_TEXT_CONTRAST = 4.5

/** 可供 Boss 快速选择的有限品牌色，仍允许输入自定义 #RRGGBB。 */
export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { label: '平台青', value: TOKEN_COLOR.primaryBase },
  { label: '商务蓝', value: '#2563EB' },
  { label: '深海蓝', value: '#1D4ED8' },
  { label: '森林绿', value: '#2F7D5A' },
  { label: '朱砂红', value: '#B94A3D' },
  { label: '琥珀棕', value: '#A16207' },
  { label: '墨灰', value: '#374151' }
]

function parseHex(value: string | null | undefined): Rgb | null {
  const input = String(value || '').trim()
  if (!HEX_COLOR.test(input)) return null
  return {
    r: Number.parseInt(input.slice(1, 3), 16),
    g: Number.parseInt(input.slice(3, 5), 16),
    b: Number.parseInt(input.slice(5, 7), 16)
  }
}

function toHex(value: Rgb): string {
  const channel = (part: number) => Math.round(Math.max(0, Math.min(255, part))).toString(16).padStart(2, '0').toUpperCase()
  return `#${channel(value.r)}${channel(value.g)}${channel(value.b)}`
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const ratio = Math.max(0, Math.min(1, amount))
  return {
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio
  }
}

function linearChannel(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(value: Rgb): number {
  return 0.2126 * linearChannel(value.r) + 0.7152 * linearChannel(value.g) + 0.0722 * linearChannel(value.b)
}

function whiteTextContrast(value: Rgb): number {
  return 1.05 / (luminance(value) + 0.05)
}

/** 主按钮统一白字：过浅品牌色逐步压深，确保至少达到 4.5:1。 */
function ensureWhiteTextContrast(value: Rgb): Rgb {
  let next = value
  for (let index = 0; index < 32 && whiteTextContrast(next) < MIN_WHITE_TEXT_CONTRAST; index += 1) {
    next = mix(next, { r: 0, g: 0, b: 0 }, 0.08)
  }
  return next
}

function rgba(value: Rgb, alpha: number): string {
  return `rgba(${Math.round(value.r)}, ${Math.round(value.g)}, ${Math.round(value.b)}, ${alpha})`
}

/** 仅接受 #RRGGBB（输入会 trim，不扩展到 3/4/8 位色值）。 */
export function normalizeBrandColor(value: string | null | undefined): string | null {
  const parsed = parseHex(value)
  return parsed ? toHex(parsed) : null
}

export function buildBrandTheme(value?: string | null): BrandTheme {
  const platformPrimary = parseHex(TOKEN_COLOR.primaryBase)
  if (!platformPrimary) throw new Error('平台主色 Token 必须是 #RRGGBB')
  const parsed = parseHex(value) || platformPrimary
  const primary = ensureWhiteTextContrast(parsed)
  const dark = mix(primary, { r: 0, g: 0, b: 0 }, 0.22)
  const deep = mix(primary, { r: 0, g: 0, b: 0 }, 0.38)
  const light = mix(primary, { r: 255, g: 255, b: 255 }, 0.18)
  const lighter = mix(primary, { r: 255, g: 255, b: 255 }, 0.88)
  const lightest = mix(primary, { r: 255, g: 255, b: 255 }, 0.95)
  const primaryHex = toHex(primary)
  const darkHex = toHex(dark)
  const deepHex = toHex(deep)
  const lightHex = toHex(light)
  return {
    input: normalizeBrandColor(value) || TOKEN_COLOR.primaryBase,
    primary: primaryHex,
    primaryDark: darkHex,
    primaryDeep: deepHex,
    primaryLight: lightHex,
    primaryLighter: toHex(lighter),
    primaryLightest: toHex(lightest),
    border: rgba(primary, 0.24),
    shadow: rgba(primary, 0.24),
    gradient: `linear-gradient(135deg, ${lightHex} 0%, ${primaryHex} 52%, ${deepHex} 100%)`,
    gradientSoft: `linear-gradient(145deg, ${rgba(light, 0.16)} 0%, ${rgba(primary, 0.04)} 100%)`
  }
}

/** 绑定到套餐页面根节点，供子组件与全局 Jz 组件通过 CSS 变量继承。 */
export function serializeBrandTheme(theme: BrandTheme): string {
  return [
    `--jzb-brand-primary:${theme.primary}`,
    `--jzb-brand-primary-dark:${theme.primaryDark}`,
    `--jzb-brand-primary-deep:${theme.primaryDeep}`,
    `--jzb-brand-primary-light:${theme.primaryLight}`,
    `--jzb-brand-primary-lighter:${theme.primaryLighter}`,
    `--jzb-brand-primary-lightest:${theme.primaryLightest}`,
    `--jzb-brand-border:${theme.border}`,
    `--jzb-brand-shadow:${theme.shadow}`,
    `--jzb-brand-gradient:${theme.gradient}`,
    `--jzb-brand-gradient-soft:${theme.gradientSoft}`
  ].join(';')
}
