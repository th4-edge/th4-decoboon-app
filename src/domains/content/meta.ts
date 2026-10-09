import { STATUS_COLOR, TOKEN_COLOR } from '@/styles/tokens'
import type { ContentAssetStatus, ContentAuthorizationPurpose, ContentAuthorizationStatus, ContentMediaType, ContentTruthType } from './model'

export const CONTENT_MEDIA_META: Record<ContentMediaType, { label: string; icon: 'camera' | 'play' | 'message' | 'file-text' }> = {
  image: { label: '图片', icon: 'camera' },
  video: { label: '视频', icon: 'play' },
  audio: { label: '音频', icon: 'message' },
  text: { label: '文案', icon: 'file-text' }
}

export const CONTENT_TRUTH_META: Record<ContentTruthType, { label: string; color: string }> = {
  native: { label: '真实', color: TOKEN_COLOR.success },
  test: { label: '测试', color: STATUS_COLOR.info },
  demo: { label: '演示', color: TOKEN_COLOR.purple },
  hypothesis: { label: '待验证', color: STATUS_COLOR.pending }
}

export const CONTENT_ASSET_STATUS_META: Record<ContentAssetStatus, { label: string; color: string }> = {
  draft: { label: '待整理', color: TOKEN_COLOR.text3 },
  internalReady: { label: '内部可用', color: TOKEN_COLOR.primary },
  publicReady: { label: '公开可用', color: TOKEN_COLOR.success },
  marketingReady: { label: '宣传可用', color: TOKEN_COLOR.purple },
  expired: { label: '已过期', color: STATUS_COLOR.pending },
  revoked: { label: '已撤回', color: TOKEN_COLOR.danger },
  blocked: { label: '已阻断', color: TOKEN_COLOR.danger }
}

export const CONTENT_PURPOSE_META: Record<ContentAuthorizationPurpose, { label: string; description: string }> = {
  internal: { label: '企业内使用', description: '员工可领取素材用于内部创作' },
  public: { label: '公开发布', description: '可在授权平台公开发布' },
  znDqMarketing: { label: '装得清宣传', description: '默认关闭，需企业、客户和员工授权' }
}

export const CONTENT_AUTH_STATUS_META: Record<ContentAuthorizationStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: STATUS_COLOR.pending },
  authorized: { label: '已授权', color: TOKEN_COLOR.success },
  expiring: { label: '即将到期', color: STATUS_COLOR.alert },
  expired: { label: '已过期', color: STATUS_COLOR.closed },
  revoked: { label: '已撤回', color: TOKEN_COLOR.danger },
  disabled: { label: '已禁用', color: TOKEN_COLOR.text3 }
}

export const CONTENT_TASK_STATUS_META: Record<import('./model').ContentTaskStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: TOKEN_COLOR.text3 },
  published: { label: '待领取', color: TOKEN_COLOR.primary },
  claimed: { label: '进行中', color: STATUS_COLOR.doing },
  completed: { label: '已完成', color: TOKEN_COLOR.success },
  closed: { label: '已关闭', color: TOKEN_COLOR.text3 }
}

export const EMPLOYEE_CONTENT_STATUS_META: Record<import('./model').EmployeeContentStatus, { label: string; color: string }> = {
  notStarted: { label: '未开始', color: TOKEN_COLOR.text3 },
  drafting: { label: '制作中', color: STATUS_COLOR.doing },
  rendering: { label: '生成中', color: TOKEN_COLOR.purple },
  pendingReview: { label: '待审核', color: STATUS_COLOR.pending },
  readyToPublish: { label: '可发布', color: TOKEN_COLOR.primary },
  published: { label: '已发布', color: TOKEN_COLOR.success },
  backfilled: { label: '已回填', color: TOKEN_COLOR.success },
  rejected: { label: '需修改', color: TOKEN_COLOR.danger }
}


export const CONTENT_SOURCE_META: Record<import('./model').ContentSourceType, { label: string }> = {
  camera: { label: '现场拍摄' },
  album: { label: '相册选择' },
  project: { label: '项目素材' },
  import: { label: '导入素材' }
}

export const CONTENT_REVIEW_STATUS_META: Record<string, { label: string; color: string }> = {
  Pending: { label: '待审核', color: STATUS_COLOR.pending },
  Approved: { label: '审核通过', color: TOKEN_COLOR.success },
  Rejected: { label: '已驳回', color: TOKEN_COLOR.danger },
  PendingReview: { label: '待审核', color: STATUS_COLOR.pending },
  ReadyToPublish: { label: '可发布', color: TOKEN_COLOR.primary }
}

export const CONTENT_PUBLISH_STATUS_META: Record<string, { label: string; color: string }> = {
  NotPublished: { label: '未发布', color: TOKEN_COLOR.text3 },
  Published: { label: '已发布', color: TOKEN_COLOR.success },
  Backfilled: { label: '已回填', color: TOKEN_COLOR.success },
  Failed: { label: '发布失败', color: TOKEN_COLOR.danger }
}
