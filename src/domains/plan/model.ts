export interface PaymentPlanNodeTemplate {
  code: string
  name: string
  ratio: number
  type: string
  triggerType: string
  triggerStageCode?: string
  offsetDays: number
  sort: number
}

export type PlanTemplateSource = 'baseline' | 'company'
export type PlanTemplateStatus = 'draft' | 'enabled' | 'disabled'

export interface PaymentPlanTemplate {
  templateId?: string
  code: string
  version: number
  name: string
  description: string
  sort: number
  source: PlanTemplateSource
  sourceBaselineCode?: string
  sourceBaselineVersion?: number
  status: PlanTemplateStatus
  defaultPlan: boolean
  currentEnabled: boolean
  nodes: PaymentPlanNodeTemplate[]
}

export interface ConstructionStageTemplate {
  code: string
  name: string
  defaultDays: number
  acceptanceMode: string
  sort: number
  description?: string
}

export interface ConstructionPlanTemplate {
  templateId?: string
  code: string
  version: number
  name: string
  description: string
  totalDays: number
  sort: number
  source: PlanTemplateSource
  sourceBaselineCode?: string
  sourceBaselineVersion?: number
  status: PlanTemplateStatus
  defaultPlan: boolean
  currentEnabled: boolean
  stages: ConstructionStageTemplate[]
}

export interface PaymentPlanTemplateInput {
  templateId?: string
  sourceBaselineCode?: string
  name: string
  description?: string
  sort?: number
  nodes: PaymentPlanNodeTemplate[]
}

export interface ConstructionPlanTemplateInput {
  templateId?: string
  sourceBaselineCode?: string
  name: string
  description?: string
  sort?: number
  totalDays?: number
  stages: ConstructionStageTemplate[]
}

export interface PlanTemplateCatalog {
  paymentPlanBaselineVersion: number
  constructionPlanBaselineVersion: number
  paymentPlans: PaymentPlanTemplate[]
  constructionPlans: ConstructionPlanTemplate[]
  total?: number
  current?: number
  size?: number
  hasMore?: boolean
}

export interface ContractPaymentNode {
  nodeId?: string
  code: string
  name: string
  ratio: number
  amount: number
  type: string
  triggerType: string
  triggerStageCode?: string
  triggerStageName?: string
  offsetDays: number
  dueDate?: string
  sort: number
}

export interface ContractPaymentPlan {
  planId?: string
  sourceCode: string
  sourceVersion: number
  name: string
  totalAmount: number
  status: string
  nodes: ContractPaymentNode[]
}

export interface ContractConstructionStage {
  stageId?: string
  code: string
  name: string
  sort: number
  defaultDays: number
  plannedStart?: string
  plannedEnd?: string
  acceptanceMode: string
  description?: string
}

export interface ContractConstructionPlan {
  planId?: string
  sourceCode: string
  sourceVersion: number
  sourceTotalDays?: number
  name: string
  startDate?: string
  endDate?: string
  status: string
  stages: ContractConstructionStage[]
}
