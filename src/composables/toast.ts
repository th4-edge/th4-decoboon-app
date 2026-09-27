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

export function confirm(title: string, content = '', okText = '确定'): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title, content, confirmText: okText, confirmColor: TOKEN_COLOR.primaryBase,
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false)
    })
  })
}
export function loading(title = '处理中...') {
  uni.showLoading({ title, mask: true })
}
export function hideLoading() {
  uni.hideLoading()
}
