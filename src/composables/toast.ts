import { P } from '@/config'
import { helpTopicForError } from '@/core/errorHelp'
import { openAlert, openConfirm, openPrompt } from '@/composables/dialog'
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
    void openConfirm({
      title: '如何处理这个问题',
      content: message,
      confirmText: '查看解决方法',
      cancelText: '知道了',
      onConfirm: () => uni.navigateTo({ url: `${P.helpCenter}?topic=${topic}` })
    }).finally(() => { helpErrorVisible = false })
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
  return openConfirm({
    title: options.title,
    content: options.content || '',
    confirmText: options.confirmText || (danger ? '确认操作' : '确定'),
    cancelText: options.cancelText || '取消',
    tone: danger ? 'danger' : 'primary'
  })
}

export function confirmDanger(title: string, content = '', okText = '确认删除'): Promise<boolean> {
  return confirmAction({ title, content, confirmText: okText, tone: 'danger' })
}
/** 带文本输入的确认框，用于删除等需要填写原因的动作。 */
export function promptText(title: string, placeholder = '', content = ''): Promise<string | null> {
  return openPrompt({ title, content, placeholder, confirmText: '确认', tone: 'danger' })
}

/** 信息说明类弹窗（仅一个确认按钮）。 */
export function alert(title: string, content = ''): Promise<boolean> {
  return openAlert({ title, content, confirmText: '知道了' })
}

export function loading(title = '处理中...') {
  uni.showLoading({ title, mask: true })
}
export function hideLoading() {
  uni.hideLoading()
}
