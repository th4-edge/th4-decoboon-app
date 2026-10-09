import { reactive } from 'vue'

export type DialogTone = 'primary' | 'danger' | 'warning'

export interface DialogAction {
  title: string
  content?: string
  confirmText?: string
  cancelText?: string
  tone?: DialogTone
  /** 只展示一个确认按钮（信息/说明类） */
  showCancel?: boolean
  /** 需要用户填写文本时开启 */
  editable?: boolean
  placeholder?: string
  maxlength?: number
  /** 点击确认后执行（用于「查看解决方法」跳转等） */
  onConfirm?: () => void
}

export interface DialogState extends Required<Pick<DialogAction, 'title' | 'content' | 'confirmText' | 'cancelText' | 'tone' | 'showCancel' | 'editable' | 'placeholder' | 'maxlength'>> {
  visible: boolean
  value: string
}

/**
 * 全局确认弹窗状态。
 *
 * `uni.showModal` 无法承载金额明细、影响清单和危险操作分级，故统一由
 * `JzConfirmDialog` 渲染；页面只需在模板放一个 `<JzConfirmDialog />` 宿主。
 * 同一时刻只允许一个确认弹窗，符合原生 showModal 的串行语义。
 */
export const dialogState = reactive<DialogState>({
  visible: false,
  title: '',
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  tone: 'primary',
  showCancel: true,
  editable: false,
  placeholder: '',
  maxlength: 200,
  value: ''
})

export interface ActionSheetState {
  visible: boolean
  title: string
  options: string[]
  cancelText: string
}

/** 动作面板状态；与确认弹窗共用宿主，同一时刻只允许一个浮层。 */
export const actionSheetState = reactive<ActionSheetState>({
  visible: false,
  title: '',
  options: [],
  cancelText: '取消'
})

let actionSheetResolver: ((index: number | null) => void) | null = null

let resolver: ((value: boolean | string | null) => void) | null = null

function settle(value: boolean | string | null) {
  const resolve = resolver
  resolver = null
  dialogState.visible = false
  resolve?.(value)
}

/** 打开确认弹窗；resolve(true/false)。 */
export function openConfirm(options: DialogAction): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (resolver) settle(null)
    dialogState.title = options.title
    dialogState.content = options.content || ''
    dialogState.confirmText = options.confirmText || '确定'
    dialogState.cancelText = options.cancelText || '取消'
    dialogState.tone = options.tone || 'primary'
    dialogState.showCancel = options.showCancel !== false
    dialogState.editable = Boolean(options.editable)
    dialogState.placeholder = options.placeholder || ''
    dialogState.maxlength = options.maxlength || 200
    dialogState.value = ''
    dialogState.visible = true
    resolver = (value) => {
      const confirmed = value === true
      if (confirmed) options.onConfirm?.()
      resolve(confirmed)
    }
  })
}

/** 打开带文本输入的确认弹窗；resolve(文本或 null)。 */
export function openPrompt(options: DialogAction & { placeholder?: string }): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    if (resolver) settle(null)
    dialogState.title = options.title
    dialogState.content = options.content || ''
    dialogState.confirmText = options.confirmText || '确认'
    dialogState.cancelText = options.cancelText || '取消'
    dialogState.tone = options.tone || 'danger'
    dialogState.showCancel = true
    dialogState.editable = true
    dialogState.placeholder = options.placeholder || ''
    dialogState.maxlength = options.maxlength || 200
    dialogState.value = ''
    dialogState.visible = true
    resolver = (value) => {
      if (typeof value === 'string') {
        const trimmed = value.trim()
        options.onConfirm?.()
        resolve(trimmed)
      } else {
        resolve(null)
      }
    }
  })
}

/** 仅说明、无取消按钮的弹窗。 */
export function openAlert(options: DialogAction): Promise<boolean> {
  return openConfirm({ ...options, showCancel: false, confirmText: options.confirmText || '知道了' })
}

/** 打开动作面板；resolve 选中下标，取消为 null。 */
export function openActionSheet(options: { title?: string; itemList: string[]; cancelText?: string }): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    actionSheetResolver = resolve
    actionSheetState.title = options.title || ''
    actionSheetState.options = [...options.itemList]
    actionSheetState.cancelText = options.cancelText || '取消'
    actionSheetState.visible = true
  })
}

export function actionSheetSelect(index: number) {
  const resolve = actionSheetResolver
  actionSheetResolver = null
  actionSheetState.visible = false
  resolve?.(index)
}

export function actionSheetCancel() {
  const resolve = actionSheetResolver
  actionSheetResolver = null
  actionSheetState.visible = false
  resolve?.(null)
}

export function dialogCancel() {
  settle(null)
}

export function dialogConfirm() {
  settle(dialogState.editable ? dialogState.value : true)
}


// 仅 DEV 构建暴露，供自动化验收直接驱动弹窗（生产构建该分支不会执行）。
if (import.meta.env.DEV && typeof globalThis !== 'undefined') {
  ;(globalThis as Record<string, unknown>).__JZ_DIALOG__ = { state: dialogState, openConfirm, openAlert, openPrompt }
}
