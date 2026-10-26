import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { P, runtime } from '@/config'

/**
 * 统一分享图。
 *
 * 微信分享卡片推荐 5:4（500×400）；当前使用品牌 Logo Mark 兜底，
 * 专用 5:4 分享卡片资产补齐后只需替换此常量。
 * 禁止使用含客户姓名、电话、金额的真实项目截图。
 */
export const SHARE_IMAGE = '/static/brand/logo-mark-color.png'

export interface ShareMessage {
  from?: 'button' | 'menu'
  target?: { dataset?: Record<string, unknown> }
}

export interface ShareCard {
  /** 分享标题：以收到的人为主语写场景，不写"分享装得清"。 */
  title: string
  /** 落地路径，必须是对方未登录也能打开的小程序路径。 */
  path?: string
  /** 用于卡片绑定动态参数时覆盖默认分享图。 */
  imageUrl?: string
}

/**
 * 页面级微信分享配置。
 *
 * 微信要求分享标题与落地路径由页面声明；不声明时客户端使用默认标题和页面截图，
 * 既不可控也无法按场景区分。本组合式函数统一分享图与兜底文案，
 * 页面只负责给出当前场景的标题和路径。
 */
export function useShare(getCard: (message?: ShareMessage) => ShareCard, timelineTitle?: string | null): void {
  onShareAppMessage((message) => {
    const card = getCard(message as ShareMessage)
    return {
      title: card.title || runtime.appName,
      path: card.path || P.home,
      imageUrl: card.imageUrl || SHARE_IMAGE
    }
  })

  // 传 null 表示本页不开放朋友圈分享：朋友圈无法携带页面参数，
  // 一次性邀请令牌这类页面分享出去就是死链，必须显式关闭。
  if (timelineTitle === null) return

  // 朋友圈分享仅在 Android 生效，且路径固定为当前页面，无法指定。
  onShareTimeline(() => ({
    title: timelineTitle || getCard().title || runtime.appName,
    imageUrl: SHARE_IMAGE
  }))
}
