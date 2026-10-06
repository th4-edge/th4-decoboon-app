/**
 * 统一业务对象选择回传契约。
 *
 * App 使用独立选择页时，通过一次性存储把结果交还来源表单；
 * 选择结果只表达“选择了哪个对象”或“清除了选择”，不直接写业务状态。
 */
export type PickerResult<T> =
  | { action: 'select'; value: T }
  | { action: 'clear' }

export interface PickerChannel<T> {
  set: (result: PickerResult<T>) => void
  consume: () => PickerResult<T> | null
}

/**
 * 创建一次性选择通道。读取即消费，避免旧结果在下次进入表单时误覆盖当前选择。
 * validator 只校验结构完整性，不代替服务端权限校验。
 */
export function createPickerChannel<T>(key: string, validator: (value: unknown) => value is T): PickerChannel<T> {
  return {
    set(result) {
      uni.setStorageSync(key, JSON.stringify(result))
    },
    consume() {
      const raw = uni.getStorageSync(key)
      if (!raw) return null
      uni.removeStorageSync(key)
      try {
        const result = JSON.parse(String(raw)) as PickerResult<unknown>
        if (result?.action === 'clear') return { action: 'clear' }
        if (result?.action === 'select' && validator(result.value)) {
          return { action: 'select', value: result.value }
        }
      } catch {
        // 存储内容损坏时忽略，不覆盖当前表单选择
      }
      return null
    }
  }
}
