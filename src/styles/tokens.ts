import { activeBrandTheme } from '@/domains/identity/brandTheme'

/** TypeScript 侧 Token；数值必须与 src/uni.scss 保持一致。 */
export const TOKEN_COLOR = {
  // 前景色 / 主色
  get primary() { return activeBrandTheme.primary },
  get primaryBase() { return activeBrandTheme.primaryBase },
  get primaryLight() { return activeBrandTheme.primaryLight },
  get primaryDark() { return activeBrandTheme.primaryDark },
  get primaryDeep() { return activeBrandTheme.primaryDeep },
  success: '#07A35A',
  warning: '#E67E22',
  danger: '#E5484D',
  purple: '#6958C8',
  // 浅底色 / soft（状态标签背景、选中态）
  get primaryLighter() { return activeBrandTheme.primaryLighter },
  get primaryLightest() { return activeBrandTheme.primaryLightest },
  successSoft: '#EAF8F0',
  warningSoft: '#FFF4E8',
  dangerSoft: '#FDECEC',
  purpleSoft: '#F0EEFC',
  // 中性文本
  text1: '#17212B',
  text2: '#465260',
  text3: '#778390',
  text4: '#AEB8C2',
  // 背景
  white: '#FFFFFF',
  bgPage: '#F4F7F8',
  bgCard: '#FFFFFF',
  bgHover: '#F8FAFB',
  get bgActive() { return activeBrandTheme.primaryLighter }
}

/** 业主端子品牌 Token；与 src/uni.scss 的 $owner-* 对齐。 */
export const OWNER_COLOR = {
  ink: '#17231F',
  ink2: '#34443E',
  muted: '#60716B',
  muted2: '#85928D',
  paper: '#F4F1E9',
  paperDeep: '#EBE6DB',
  card: '#FFFDF8',
  forest: '#0D2B25',
  forest2: '#173B33',
  moss: '#247263',
  mossLight: '#3A8F7E',
  mint: '#DFF2EB',
  copper: '#96542F',
  copperSoft: '#F2DFCF',
  danger: '#B9574D',
  warning: '#A86524'
} as const

/**
 * 业务状态色板（状态标签专用，与 src/uni.scss 的 $jzb-status-* 对齐）。
 *
 * 用法：品牌色/金额与风险语义用 TOKEN_COLOR；**业务状态标签**统一用 STATUS_COLOR，
 * 页面与 domains 下各 meta.ts 内禁止再写裸色值。
 * 取值与 2026-09-21 线上现状一致，属于「先集中、后收敛」：收敛到 6 档标准色需走视觉验收。
 */
export const STATUS_COLOR = {
  idle: '#C9CDD4',      // 未开始 / 已停用 / 已流失
  todo: '#86909C',      // 待办 / 待开工 / 低优先级
  muted: '#8B93A1',     // 已被替代 / 历史态（偏灰）
  closed: '#7A7F87',    // 已关闭 / 已过期 / 已取消
  dark: '#4E5969',      // 已结算 / 已归档 / 通知
  doing: '#13C2C2',     // 进行中
  progress: '#168A96',  // 推进中（品牌深青）
  alert: '#FA8C16',     // 施工中 / 提醒
  pending: '#FF7D00',   // 待确认 / 待处理 / 待验收
  done: '#00B42A',      // 已完成 / 已确认 / 通过
  blocked: '#F53F3F',   // 异常 / 驳回 / 逾期
  info: '#2F54EB',      // 信息类 / 待量房
  special: '#722ED1',   // 竣工验收 / 材料进场等特殊态
  accent: '#8A5CC7'     // 辅助强调（材料款等）
} as const

export type StatusTone = keyof typeof STATUS_COLOR
