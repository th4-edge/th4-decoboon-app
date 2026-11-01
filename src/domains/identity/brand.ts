import { DEFAULT_BRAND_COLOR, isValidBrandColor } from './brandTheme'

export interface CompanyBrandColor {
  value: string
  label: string
  description: string
}

/**
 * 推荐色来自站酷 B 端样本的低饱和自然色转译：青瓷、岩蓝、赤陶、胡桃、黛紫、墨灰。
 * 装得清默认保留平台产品色；新增企业主题基色与白字对比度均 ≥ 4.5。
 */
export const COMPANY_BRAND_COLORS: CompanyBrandColor[] = [
  { value: '', label: '装得清默认', description: '保留装得清产品品牌色' },
  { value: '#5C7C6E', label: '青瓷', description: '清润克制，适合设计与软装型团队' },
  { value: '#2F6E63', label: '松石墨绿', description: '稳健耐看，适合综合型装企' },
  { value: '#4F708C', label: '岩蓝', description: '理性清晰，适合工程与交付管理' },
  { value: '#A65F46', label: '赤陶', description: '温暖有辨识度，适合住宅整装' },
  { value: '#7A5540', label: '胡桃', description: '沉静有质感，适合中高端定制' },
  { value: '#675D7B', label: '黛紫', description: '雅致克制，适合设计主导型团队' },
  { value: '#3F4B53', label: '墨灰', description: '专业中性，适合工程与财务协同' }
]

export function companyBrandColor(value?: string): string {
  return isValidBrandColor(value) ? String(value) : DEFAULT_BRAND_COLOR
}

export { DEFAULT_BRAND_COLOR, isValidBrandColor }
