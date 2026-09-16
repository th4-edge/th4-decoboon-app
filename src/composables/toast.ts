export function toast(title: string, icon: 'success' | 'error' | 'none' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}

export function toastError(error: unknown, fallback = '操作失败，请稍后重试') {
  if (error && typeof error === 'object' && (error as { presented?: boolean }).presented) return
  const message = error instanceof Error ? error.message.trim() : ''
  toast(message || fallback)
}

export function confirm(title: string, content = '', okText = '确定'): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title, content, confirmText: okText, confirmColor: '#16A394',
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
