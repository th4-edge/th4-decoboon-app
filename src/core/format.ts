import { TOKEN_COLOR } from '@/styles/tokens'
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

interface DateTimeParts {
  year: string
  month: string
  day: string
  hour?: string
  minute?: string
}

/** 把 `2026-09-10T05:03:07` / `2026-09-10 05:03:07` / `yyyyMMddHHmmss` 拆成展示用的年月日时分。 */
function dateTimeParts(value?: string | number | null): DateTimeParts | null {
  const normalized = dateTimeValue(value)
  if (!normalized) return null
  const matched = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(normalized)
  if (!matched) return null
  return { year: matched[1], month: matched[2], day: matched[3], hour: matched[4], minute: matched[5] }
}

/**
 * 友好日期时间：`2026-09-10T05:03:07` → `2026-09-10 05:03`。
 *
 * 历史坑：后端 `DateTime` / `LocalDateTime` 直接 `toString()` 会把 ISO 原文（带 T 和秒）
 * 透传到页面，业主端「量房档案」曾原样展示 `2026-09-10T05:03:07`。
 * 所有面向用户的日期时间统一走本函数，禁止在页面里对原始字符串 `slice`。
 */
export function dateTimeText(value?: string | number | null): string {
  const parts = dateTimeParts(value)
  if (!parts) return dateTimeValue(value) ?? ''
  const time = parts.hour === undefined ? '' : ` ${parts.hour}:${parts.minute}`
  return `${parts.year}-${parts.month}-${parts.day}${time}`
}

/** 紧凑日期时间：`2026-09-10T05:03:07` → `09-10 05:03`，用于统计位等窄栏。 */
export function dateTimeShortText(value?: string | number | null): string {
  const parts = dateTimeParts(value)
  if (!parts) return dateTimeValue(value) ?? ''
  const time = parts.hour === undefined ? '' : ` ${parts.hour}:${parts.minute}`
  return `${parts.month}-${parts.day}${time}`
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
export function moneyParts(n?: number | null): MoneyPart {
  if (n === undefined || n === null || Number.isNaN(n)) {
    return { value: '-', unit: '', text: '-', unitKey: 'yuan' }
  }
  if (Math.abs(n) >= 10000) {
    const v = Math.round(n / 100) / 100
    const value = v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    return { value, unit: '万', text: `${value}万`, unitKey: 'wan' }
  }
  const value = Math.round(n).toLocaleString('zh-CN')
  const negative = value.startsWith('-')
  return {
    value,
    unit: '元',
    text: `${negative ? '-' : ''}¥${negative ? value.slice(1) : value}`,
    unitKey: 'yuan'
  }
}

/** 金额文案：≥1 万显示为「12.3万」，否则显示「¥9,800」。 */
export function money(n?: number | null, withUnit = true): string {
  const part = moneyParts(n)
  if (!withUnit) return part.value
  return part.text
}

/**
 * 精确金额文案：始终保留两位小数和千分位，用于财务对账页与 Web `MoneyText` 同口径展示。
 * 缺值仍返回 `-`，不得用 0 伪装。
 */
export function moneyExact(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '-'
  const sign = n < 0 ? '-' : ''
  const [integer, fraction] = Math.abs(n).toFixed(2).split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}¥${grouped}.${fraction}`
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

/** 主材选材结果字段：键顺序即录入顺序，与后端 SelectionText 对齐。 */
const SELECTION_LABELS: Array<[string, string]> = [
  ['color', '颜色/花色'],
  ['spec', '规格/型号'],
  ['brand', '品牌/系列'],
  ['craft', '工艺'],
  ['remark', '备注']
]

export interface SelectionField {
  key: string
  label: string
  value: string
}

/**
 * 主材选材结果结构化：优先解析 `selection_json`，否则拆「标签：值；标签：值」文本。
 *
 * 历史坑：后端曾把 `selection_json` 原样塞进旅程 lines，业主端直接渲染出
 * `{"color":"暖灰石纹","spec":"800×800"}` 一长串 JSON。展示层必须转成字段再渲染。
 */
export function selectionFields(json?: string, fallbackText?: string): SelectionField[] {
  const fields: SelectionField[] = []
  const raw = (json || '').trim()
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      for (const [key, label] of SELECTION_LABELS) {
        const value = parsed[key]
        if (value === null || value === undefined) continue
        const text = String(value).trim()
        if (text) fields.push({ key, label, value: text })
      }
      if (fields.length) return fields
    } catch {
      // 解析失败时落到可读文本解析
    }
  }
  const text = (fallbackText || '').trim()
  if (!text) return fields
  text.split('；').forEach((segment, index) => {
    const trimmed = segment.trim()
    if (!trimmed) return
    const colon = trimmed.indexOf('：')
    if (colon <= 0) {
      fields.push({ key: `segment-${index}`, label: '', value: trimmed })
      return
    }
    fields.push({
      key: `field-${index}`,
      label: trimmed.slice(0, colon).trim(),
      value: trimmed.slice(colon + 1).trim()
    })
  })
  return fields
}

/** 把可能残留 JSON 的一行选材结果转回「标签：值；…」，非 JSON 文本原样返回。 */
export function selectionLineText(line?: string): string {
  const raw = (line || '').trim()
  if (!raw) return ''
  const fields = raw.startsWith('{') ? selectionFields(raw) : selectionFields(undefined, raw)
  if (!fields.length) return raw
  return fields.map((field) => (field.label ? `${field.label}：${field.value}` : field.value)).join('；')
}

/** 相对今天：x天前/后（只取日期部分，避免 ISO 带 T 时解析失败） */
export function diffDays(s?: string): number {
  if (!s) return 0
  const target = new Date(s.slice(0, 10).replace(/-/g, '/')).getTime()
  if (Number.isNaN(target)) return 0
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

/** 截止/到期相对今天：今天到期 / 还差 N 天 / 已逾期 N 天（前端计算，不依赖后端）。 */
export function dueText(s?: string): string {
  if (!s || s === '—') return ''
  const days = diffDays(s)
  if (days === 0) return '今天到期'
  if (days > 0) return `还差 ${days} 天`
  return `已逾期 ${-days} 天`
}

/**
 * 事实值展示：金额补 ¥、日期收敛成可读格式，其余原样。
 *
 * 历史坑：业主端各"我的家"事实条原样渲染后端值，`valueType === 'date'` 的事实
 * （签约日期、整改截止日期等）会直接显示 `2026-09-10T05:03:07`。
 */
export function factDisplay(value?: string, valueType?: string): string {
  const raw = value ?? ''
  if (!raw) return raw
  if (valueType === 'money') {
    const amount = Number(raw)
    // 后端下发的是「30000.00」这种分/元原值，这里统一成「3万 / ¥9,800」，避免丢单位或长尾小数
    return Number.isNaN(amount) ? raw : money(amount)
  }
  if (valueType === 'date') return dateTimeText(raw).slice(0, 10)
  return raw
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
  return Array.from(name.trim())[0] || '家'
}

/** 由姓名生成稳定头像底色 */
export function colorOf(name?: string): string {
  const palette = [TOKEN_COLOR.primaryBase, '#722ED1', '#FA8C16', '#13C2C2', '#2F54EB', '#F53F3F', '#00B42A']
  if (!name) return palette[0]
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return palette[sum % palette.length]
}
