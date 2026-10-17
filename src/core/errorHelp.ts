interface ErrorHelpRule {
  topic: string
  pattern: RegExp
}

const RULES: ErrorHelpRule[] = [
  { topic: 'login-phone-required', pattern: /手机号|PHONE_REQUIRED|微信登录/i },
  { topic: 'invite-not-joined', pattern: /邀请|加入企业|尚未加入企业/i },
  { topic: 'no-property-measure', pattern: /报价缺少客户房屋|请先建立并选择房屋|约定量房|房屋档案/i },
  { topic: 'cannot-see-customer', pattern: /无权|403|不存在或无权访问|企业.*不一致|跨企业/i },
  { topic: 'quote-cost-incomplete', pattern: /成本未完整|标准成本|成本.*(缺失|补齐)/i },
  { topic: 'contract-no-project', pattern: /合同.*(生效|签约)|只有已生效合同|请先完成合同签约/i },
  { topic: 'selection-not-visible', pattern: /主材选材|选材记录|选材结果/i },
  { topic: 'material-sheet-time', pattern: /作业单.*(测量|时间|配送|安装)|提交.*(测量|配送|安装)|模板.*必填|复尺/i },
  { topic: 'material-sheet-cancel', pattern: /取消作业单|已进入采购.*取消|进入采购.*锁定/i },
  { topic: 'cannot-purchase-material', pattern: /供应商|采购价|采购单|材料计划.*采购/i },
  { topic: 'upload-failed', pattern: /uploadFile|文件上传|上传服务|照片上传|视频上传|下载地址/i },
  { topic: 'owner-cannot-see', pattern: /业主.*(项目|授权)|项目授权|customer access/i },
  { topic: 'stage-status-conflict', pattern: /项目状态.*(阶段|冲突)|验收.*(驳回|整改)|整改轮次|阶段验收/i },
  { topic: 'feedback-progress', pattern: /反馈.*(处理|关闭|进度)/i }
]

export function helpTopicForError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const message = error instanceof Error ? error.message : ''
  if (!message) return null
  return RULES.find((rule) => rule.pattern.test(message))?.topic || null
}
