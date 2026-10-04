import { reactive } from 'vue'

export interface InputDialogOptions {
  title: string
  label?: string
  description?: string
  placeholder?: string
  type?: 'text' | 'number' | 'digit'
  maxlength?: number
  multiline?: boolean
  confirmText?: string
  cancelText?: string
}

export interface InputDialogState {
  visible: boolean
  title: string
  label: string
  description: string
  placeholder: string
  value: string
  type: 'text' | 'number' | 'digit'
  maxlength: number
  multiline: boolean
  confirmText: string
  cancelText: string
}

/** 页面级输入弹窗控制器；每个宿主页面放置一个 JzInputDialog。 */
export function useInputDialog() {
  const dialog = reactive<InputDialogState>({
    visible: false,
    title: '',
    label: '',
    description: '',
    placeholder: '',
    value: '',
    type: 'text',
    maxlength: 200,
    multiline: false,
    confirmText: '确认',
    cancelText: '取消'
  })
  let resolver: ((value: string | null) => void) | null = null

  function finish(value: string | null) {
    dialog.visible = false
    const resolve = resolver
    resolver = null
    resolve?.(value)
  }

  function open(options: InputDialogOptions): Promise<string | null> {
    finish(null)
    dialog.title = options.title
    dialog.label = options.label || ''
    dialog.description = options.description || ''
    dialog.placeholder = options.placeholder || ''
    dialog.value = ''
    dialog.type = options.type || 'text'
    dialog.maxlength = options.maxlength || 200
    dialog.multiline = options.multiline || false
    dialog.confirmText = options.confirmText || '确认'
    dialog.cancelText = options.cancelText || '取消'
    dialog.visible = true
    return new Promise((resolve) => { resolver = resolve })
  }

  function confirm() {
    const value = dialog.value.trim()
    if (!value) return
    finish(value)
  }

  function cancel() {
    finish(null)
  }

  return { dialog, open, confirm, cancel }
}
