import { toast } from './toast'

/**
 * 订阅消息场景键。
 *
 * <p>必须与后端 `com.th4.edge.components.wechat.configure.WechatSubscribeScenario`
 * 的取值逐字一致：前端负责"请求授权"，后端负责"实际发送"，场景键是两边唯一的对齐点。</p>
 */
export const SUBSCRIBE_SCENARIO = {
  /** 业主：阶段验收待确认 */
  ownerAcceptancePending: 'owner.acceptance-pending',
  /** 员工：业主已确认或驳回验收 */
  employeeAcceptanceDecision: 'employee.acceptance-decision'
} as const

export type SubscribeScenario = (typeof SUBSCRIBE_SCENARIO)[keyof typeof SUBSCRIBE_SCENARIO]

/**
 * 场景 → 微信模板 ID。
 *
 * <p>模板 ID 由公众平台申请得到，构建期通过环境变量注入，**必须与后端
 * `subscribe-templates` 配置使用同一组 ID**：只配一边会出现"授权了却收不到"
 * 或"后端想发但用户没被请求过授权"这类无法从代码看出的故障。</p>
 *
 * <p>未配置时对应场景整体跳过：不弹授权框、不报错、不阻断任何业务动作。</p>
 */
const TEMPLATE_IDS: Record<SubscribeScenario, string> = {
  [SUBSCRIBE_SCENARIO.ownerAcceptancePending]:
    import.meta.env.VITE_WECHAT_TEMPLATE_OWNER_ACCEPTANCE_PENDING || '',
  [SUBSCRIBE_SCENARIO.employeeAcceptanceDecision]:
    import.meta.env.VITE_WECHAT_TEMPLATE_EMPLOYEE_ACCEPTANCE_DECISION || ''
}

/** 该场景是否已配置模板：未配置时调用方不必触发任何用户可见交互。 */
export function isSubscribeConfigured(scenario: SubscribeScenario): boolean {
  return !!TEMPLATE_IDS[scenario]
}

interface SubscribeMessageOptions {
  tmplIds: string[]
  success?: (result: Record<string, string>) => void
  fail?: (error: unknown) => void
}

/** uni-app 未提供 requestSubscribeMessage 的类型声明，这里只补最小可用签名。 */
const requestSubscribeMessage = (
  uni as unknown as { requestSubscribeMessage: (options: SubscribeMessageOptions) => void }
).requestSubscribeMessage

/**
 * 请求订阅消息授权。
 *
 * <p>微信一次性订阅：用户每授权一次，服务端获得一次发送额度。因此调用时机必须是
 * 用户刚刚完成一个与其相关的动作之后（例如业主刚确认完本次验收），而不是进页面就弹。</p>
 *
 * @returns 是否至少有一个模板获得授权。用户拒绝、基础库过低、非微信端都返回 false，
 *          不视为错误，也不打断调用方的业务流程。
 */
export function requestSubscribe(
  scenarios: SubscribeScenario[],
  options: { silent?: boolean } = {}
): Promise<boolean> {
  const tmplIds = scenarios
    .map((scenario) => TEMPLATE_IDS[scenario])
    .filter((id): id is string => !!id)
  if (!tmplIds.length || typeof requestSubscribeMessage !== 'function') {
    return Promise.resolve(false)
  }
  return new Promise<boolean>((resolve) => {
    requestSubscribeMessage({
      tmplIds,
      success: (result) => {
        const accepted = tmplIds.some((id) => result[id] === 'accept')
        if (accepted && !options.silent) toast('已开启微信提醒', 'success')
        resolve(accepted)
      },
      // 用户拒绝或客户端不支持：不算错误，静默返回，避免在成功流程里弹出失败提示。
      fail: () => resolve(false)
    })
  })
}
