/** 展示格式化工具 */

/** 后端 DateTime 可能序列化为 yyyyMMddHHmmss，统一成可读时间字符串。 */
export function dateTimeValue(value?: string | number | null): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const raw = String(value)
  if (/^\d{14}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`
  }
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return raw
}

/** 金额：分 -> 元展示（入参统一为元） */
export interface MoneyPart {
  /** 数值部分（不含单位） */
  value: string
  /** 单位：万 / 元 */
  unit: string
  /** 完整文案 */
  text: string
  /** 单位类型，供调用方区分着色 */
  unitKey: 'wan' | 'yuan'
}

/**
 * 金额拆分：家装金额普遍超过 1 万，因此 ≥10000 以「万元」为单位、否则以「元」为单位，
 * 并返回单位类型（wan/yuan）供界面区分着色。
 */
export function moneyParts(n?: number): MoneyPart {
  if (n === undefined || n === null || Number.isNaN(n)) {
    return { value: '-', unit: '', text: '-', unitKey: 'yuan' }
  }
  if (Math.abs(n) >= 10000) {
    const v = Math.round(n / 100) / 100
    const value = v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    return { value, unit: '万', text: `${value}万`, unitKey: 'wan' }
  }
  const value = Math.round(n).toLocaleString('zh-CN')
  return { value, unit: '元', text: `¥${value}`, unitKey: 'yuan' }
}

/** 金额文案：≥1 万显示为「12.3万」，否则显示「¥9,800」。 */
export function money(n?: number, withUnit = true): string {
  const part = moneyParts(n)
  if (!withUnit) return part.value
  return part.text
}

/** 万元展示 */
export function wan(n?: number): string {
  if (n === undefined || n === null) return '-'
  return `${Math.round(n * 10) / 10}万`
}

export function dateText(s?: string): string {
  if (!s) return '未设置'
  return s.slice(0, 10)
}

/** 相对今天：x天前/后 */
export function diffDays(s?: string): number {
  if (!s) return 0
  const target = new Date(s.replace(/-/g, '/')).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86400000)
}

export function daysText(s?: string): string {
  const d = diffDays(s)
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  if (d === -1) return '昨天'
  if (d > 1) return `${d}天后`
  return `${-d}天前`
}

export function timeText(s?: string): string {
  if (!s) return ''
  const t = s.length > 10 ? s.slice(11, 16) : ''
  return `${s.slice(5, 10).replace('-', '月')}日${t ? ' ' + t : ''}`
}

/** 手机号脱敏（客户侧展示用） */
export function maskPhone(p?: string): string {
  if (!p || p.length < 7) return p || ''
  return `${p.slice(0, 3)}****${p.slice(-4)}`
}

/** 姓名首个字符（头像占位） */
export function nameChar(name?: string): string {
  if (!name) return '家'
  return name.slice(-2)
}

/** 由姓名生成稳定头像底色 */
export function colorOf(name?: string): string {
  const palette = ['#16A394', '#722ED1', '#FA8C16', '#13C2C2', '#2F54EB', '#F53F3F', '#00B42A']
  if (!name) return palette[0]
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return palette[sum % palette.length]
}
