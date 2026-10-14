import type { JourneyVendor } from '@/domains/journey/model'

/**
 * 5:4 微信分享卡片（动态生成）。
 *
 * 为什么用 canvas 而不是静态素材：
 * 微信 onShareAppMessage 的 imageUrl 只接受静态路径或网络地址，而按
 * ANS-BIZ-20261010-004 §4「叙事主体归装企」，卡片上必须出现**装企名**，
 * 静态素材无法承载每租户品牌。故在页面数据就绪后画一张临时图。
 *
 * 硬规则：卡片上不得出现客户姓名、电话、具体房号、金额。
 */

export const SHARE_CARD_ID = 'ownerShareCard'
export const SHARE_CARD_WIDTH = 500
export const SHARE_CARD_HEIGHT = 400

export interface ShareCardInput {
  /** 服务方品牌（来自 journey.vendor） */
  vendor?: JourneyVendor
  /** 卡片主标题，如「滨湖云谷 3 栋 · 装修全过程」 */
  title: string
}

/** 校验并归一化企业品牌色；非法值回退到装得清主色。 */
function normalizeColor(raw?: string): string {
  if (!raw) return '#0E8A7D'
  const v = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  }
  return '#0E8A7D'
}

/** 按比例提亮，用于渐变第二段。 */
function lighten(hex: string, ratio = 0.35): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * ratio))
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * ratio))
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * ratio))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** 简单按宽度折行，最多两行，超出补省略号。 */
function wrapLines(ctx: UniApp.CanvasContext, text: string, maxWidth: number, maxLines = 2): string[] {
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = ch
      if (lines.length === maxLines) break
    } else {
      current = next
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (!lines.length) lines.push('')
  if (lines.length === maxLines) {
    const joined = lines.join('')
    if (joined.length < text.length) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'
  }
  return lines
}

/**
 * 画卡片并导出临时文件路径。失败时返回空字符串，调用方回退到静态分享图。
 */
export function drawShareCard(input: ShareCardInput): Promise<string> {
  return new Promise((resolve) => {
    let ctx: UniApp.CanvasContext
    try {
      ctx = uni.createCanvasContext(SHARE_CARD_ID)
    } catch {
      resolve('')
      return
    }

    const brand = normalizeColor(input.vendor?.color)
    const vendorName = input.vendor?.name || ''

    try {
      const gradient = ctx.createLinearGradient(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)
      gradient.addColorStop(0, brand)
      gradient.addColorStop(1, lighten(brand))
      ctx.setFillStyle(gradient)
      ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)

      // 顶部：装企名（叙事主体）
      if (vendorName) {
        ctx.setFillStyle('rgba(255,255,255,0.78)')
        ctx.setFontSize(22)
        ctx.fillText(vendorName.slice(0, 16), 40, 96)
      }

      // 中部：主标题
      ctx.setFillStyle('#FFFFFF')
      ctx.setFontSize(34)
      wrapLines(ctx, input.title, SHARE_CARD_WIDTH - 80, 2).forEach((line, index) => {
        ctx.fillText(line, 40, 178 + index * 46)
      })

      // 分隔线
      ctx.setFillStyle('rgba(255,255,255,0.28)')
      ctx.fillRect(40, SHARE_CARD_HEIGHT - 92, SHARE_CARD_WIDTH - 80, 1)

      // 底部：记录存证署名（受企业配置控制，默认关闭）
      ctx.setFillStyle('rgba(255,255,255,0.72)')
      ctx.setFontSize(18)
      const credit = input.vendor?.custodianCredit
        ? '记录存证与保管 · 装得清'
        : `${vendorName || '装企'} 全程记录`
      ctx.fillText(credit.slice(0, 24), 40, SHARE_CARD_HEIGHT - 52)
    } catch {
      resolve('')
      return
    }

    ctx.draw(false, () => {
      uni.canvasToTempFilePath(
        {
          canvasId: SHARE_CARD_ID,
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
          destWidth: SHARE_CARD_WIDTH,
          destHeight: SHARE_CARD_HEIGHT,
          success: (res) => resolve(res.tempFilePath || ''),
          fail: () => resolve('')
        }
      )
    })
  })
}
