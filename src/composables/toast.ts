import { P } from '@/config'
import { helpTopicForError } from '@/core/errorHelp'
import { TOKEN_COLOR } from '@/styles/tokens'
export function toast(title: string, icon: 'success' | 'error' | 'none' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}

let helpErrorVisible = false

function isHelpPage(): boolean {
  const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  return stack.some((page) => `/${page.route || ''}`.startsWith(P.helpCenter))
}

export function toastError(error: unknown, fallback = '操作失败，请稍后重试') {
  if (error && typeof error === 'object' && (error as { presented?: boolean }).presented) return
  const message = (error instanceof Error ? error.message.trim() : '') || fallback
  const topic = helpTopicForError(error)
  if (topic && !helpErrorVisible && !isHelpPage()) {
    helpErrorVisible = true
    uni.showModal({
      title: '如何处理这个问题',
      content: message,
      confirmText: '查看解决方法',
      cancelText: '知道了',
      confirmColor: TOKEN_COLOR.primaryBase,
      success: (result) => {
        if (result.confirm) uni.navigateTo({ url: `${P.helpCenter}?topic=${topic}` })
      },
      complete: () => { helpErrorVisible = false }
    })
    return
  }
  toast(message)
}

export interface ConfirmActionOptions {
  title: string
  content?: string
  confirmText?: string
  cancelText?: string
  tone?: 'primary' | 'danger'
}

export function confirm(title: string, content = '', okText = '确定'): Promise<boolean> {
  return confirmAction({ title, content, confirmText: okText })
}

/** 高风险动作确认：文案、确认词和颜色必须与业务结果一致。 */
export function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  const danger = options.tone === 'danger'
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title,
      content: options.content || '',
      confirmText: options.confirmText || (danger ? '确认操作' : '确定'),
      cancelText: options.cancelText || '取消',
      confirmColor: danger ? TOKEN_COLOR.danger : TOKEN_COLOR.primaryBase,
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false)
    })
  })
}

export function confirmDanger(title: string, content = '', okText = '确认删除'): Promise<boolean> {
  return confirmAction({ title, content, confirmText: okText, tone: 'danger' })
}
export function loading(title = '处理中...') {
  uni.showLoading({ title, mask: true })
}
export function hideLoading() {
  uni.hideLoading()
}
