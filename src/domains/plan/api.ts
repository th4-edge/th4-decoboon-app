import { post } from '@/core/http'
import type {
  ConstructionPlanTemplate,
  ConstructionPlanTemplateInput,
  ContractConstructionPlan,
  ContractPaymentPlan,
  PaymentPlanTemplate,
  PaymentPlanTemplateInput,
  PlanTemplateStatus,
  PlanTemplateCatalog
} from './model'

type RawRecord = Record<string, unknown>

function valueOf(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const value = raw as RawRecord
    return String(value.value ?? value.key ?? value.name ?? '')
  }
  return ''
}

function text(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback
}

function number(raw: unknown, fallback = 0): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function normalizePaymentPlan(raw: RawRecord): PaymentPlanTemplate {
  return {
    templateId: raw.templateId ? String(raw.templateId) : undefined,
    code: text(raw.code),
    version: number(raw.version, 1),
    name: text(raw.name),
    description: text(raw.description),
    sort: number(raw.sort),
    source: valueOf(raw.source) === 'Company' ? 'company' : 'baseline',
    status: normalizeStatus(valueOf(raw.status)),
    defaultPlan: raw.defaultPlan === true,
    nodes: (Array.isArray(raw.nodes) ? raw.nodes : []).map((item) => {
      const node = item as RawRecord
      return {
        code: text(node.code),
        name: text(node.name),
        ratio: number(node.ratio),
        type: valueOf(node.type),
        triggerType: valueOf(node.triggerType),
        triggerStageCode: node.triggerStageCode ? String(node.triggerStageCode) : undefined,
        offsetDays: number(node.offsetDays),
        sort: number(node.sort)
      }
    })
  }
}

function normalizeConstructionPlan(raw: RawRecord): ConstructionPlanTemplate {
  return {
    templateId: raw.templateId ? String(raw.templateId) : undefined,
    code: text(raw.code),
    version: number(raw.version, 1),
    name: text(raw.name),
    description: text(raw.description),
    totalDays: number(raw.totalDays),
    sort: number(raw.sort),
    source: valueOf(raw.source) === 'Company' ? 'company' : 'baseline',
    status: normalizeStatus(valueOf(raw.status)),
    defaultPlan: raw.defaultPlan === true,
    stages: (Array.isArray(raw.stages) ? raw.stages : []).map((item) => {
      const stage = item as RawRecord
      return {
        code: text(stage.code),
        name: text(stage.name),
        defaultDays: number(stage.defaultDays, 1),
        acceptanceMode: valueOf(stage.acceptanceMode),
        sort: number(stage.sort),
        description: text(stage.description)
      }
    })
  }
}

export function normalizeContractPaymentPlan(raw: RawRecord | null | undefined): ContractPaymentPlan | undefined {
  if (!raw) return undefined
  return {
    planId: raw.planId ? String(raw.planId) : undefined,
    sourceCode: text(raw.sourceCode),
    sourceVersion: number(raw.sourceVersion, 1),
    name: text(raw.name),
    totalAmount: number(raw.totalAmount),
    status: valueOf(raw.status),
    nodes: (Array.isArray(raw.nodes) ? raw.nodes : []).map((item) => {
      const node = item as RawRecord
      return {
        nodeId: node.nodeId ? String(node.nodeId) : undefined,
        code: text(node.code),
        name: text(node.name),
        ratio: number(node.ratio),
        amount: number(node.amount),
        type: valueOf(node.type),
        triggerType: valueOf(node.triggerType),
        triggerStageCode: node.triggerStageCode ? String(node.triggerStageCode) : undefined,
        triggerStageName: node.triggerStageName ? String(node.triggerStageName) : undefined,
        offsetDays: number(node.offsetDays),
        dueDate: node.dueDate ? String(node.dueDate) : undefined,
        sort: number(node.sort)
      }
    })
  }
}

export function normalizeContractConstructionPlan(raw: RawRecord | null | undefined): ContractConstructionPlan | undefined {
  if (!raw) return undefined
  return {
    planId: raw.planId ? String(raw.planId) : undefined,
    sourceCode: text(raw.sourceCode),
    sourceVersion: number(raw.sourceVersion, 1),
    name: text(raw.name),
    startDate: raw.startDate ? String(raw.startDate) : undefined,
    endDate: raw.endDate ? String(raw.endDate) : undefined,
    status: valueOf(raw.status),
    stages: (Array.isArray(raw.stages) ? raw.stages : []).map((item) => {
      const stage = item as RawRecord
      return {
        stageId: stage.stageId ? String(stage.stageId) : undefined,
        code: text(stage.code),
        name: text(stage.name),
        sort: number(stage.sort),
        defaultDays: number(stage.defaultDays, 1),
        plannedStart: stage.plannedStart ? String(stage.plannedStart) : undefined,
        plannedEnd: stage.plannedEnd ? String(stage.plannedEnd) : undefined,
        acceptanceMode: valueOf(stage.acceptanceMode),
        description: text(stage.description)
      }
    })
  }
}

export const planApi = {
  catalog: async (): Promise<PlanTemplateCatalog> => {
    return catalog(await post<RawRecord>('plan/template/page', {}))
  },
  paymentManagement: async (): Promise<PlanTemplateCatalog> => catalog(await post<RawRecord>('plan/payment-template/page', {})),
  constructionManagement: async (): Promise<PlanTemplateCatalog> => catalog(await post<RawRecord>('plan/construction-template/page', {})),
  savePayment: async (input: PaymentPlanTemplateInput): Promise<PaymentPlanTemplate> =>
    normalizePaymentPlan(await post<RawRecord>('plan/payment-template/save', paymentPayload(input))),
  updatePayment: async (input: PaymentPlanTemplateInput): Promise<PaymentPlanTemplate> =>
    normalizePaymentPlan(await post<RawRecord>('plan/payment-template/update', paymentPayload(input))),
  publishPayment: async (templateId: string): Promise<PaymentPlanTemplate> =>
    normalizePaymentPlan(await post<RawRecord>('plan/payment-template/publish', { templateId })),
  disablePayment: async (templateId: string): Promise<PaymentPlanTemplate> =>
    normalizePaymentPlan(await post<RawRecord>('plan/payment-template/disable', { templateId })),
  defaultPayment: async (templateId: string): Promise<PaymentPlanTemplate> =>
    normalizePaymentPlan(await post<RawRecord>('plan/payment-template/default', { templateId })),
  saveConstruction: async (input: ConstructionPlanTemplateInput): Promise<ConstructionPlanTemplate> =>
    normalizeConstructionPlan(await post<RawRecord>('plan/construction-template/save', constructionPayload(input))),
  updateConstruction: async (input: ConstructionPlanTemplateInput): Promise<ConstructionPlanTemplate> =>
    normalizeConstructionPlan(await post<RawRecord>('plan/construction-template/update', constructionPayload(input))),
  publishConstruction: async (templateId: string): Promise<ConstructionPlanTemplate> =>
    normalizeConstructionPlan(await post<RawRecord>('plan/construction-template/publish', { templateId })),
  disableConstruction: async (templateId: string): Promise<ConstructionPlanTemplate> =>
    normalizeConstructionPlan(await post<RawRecord>('plan/construction-template/disable', { templateId })),
  defaultConstruction: async (templateId: string): Promise<ConstructionPlanTemplate> =>
    normalizeConstructionPlan(await post<RawRecord>('plan/construction-template/default', { templateId }))
}

function catalog(raw: RawRecord): PlanTemplateCatalog {
  return {
    paymentPlanBaselineVersion: number(raw.paymentPlanBaselineVersion, 1),
    constructionPlanBaselineVersion: number(raw.constructionPlanBaselineVersion, 1),
    paymentPlans: (Array.isArray(raw.paymentPlans) ? raw.paymentPlans : []).map(normalizePaymentPlan),
    constructionPlans: (Array.isArray(raw.constructionPlans) ? raw.constructionPlans : []).map(normalizeConstructionPlan)
  }
}

function normalizeStatus(raw: string): PlanTemplateStatus {
  if (raw === 'Draft') return 'draft'
  if (raw === 'Disabled') return 'disabled'
  return 'enabled'
}

function paymentPayload(input: PaymentPlanTemplateInput) {
  return {
    templateId: input.templateId,
    sourceBaselineCode: input.sourceBaselineCode,
    name: input.name,
    description: input.description,
    sort: input.sort ?? 0,
    nodes: input.nodes
  }
}

function constructionPayload(input: ConstructionPlanTemplateInput) {
  return {
    templateId: input.templateId,
    sourceBaselineCode: input.sourceBaselineCode,
    name: input.name,
    description: input.description,
    sort: input.sort ?? 0,
    stages: input.stages
  }
}
