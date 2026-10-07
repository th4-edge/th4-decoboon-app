import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { ConstructionPlanTemplate, PaymentPlanTemplate } from './model'

export const PAYMENT_PLAN_PICKER_KEY = 'plan_payment_template_picker_result'
export const CONSTRUCTION_PLAN_PICKER_KEY = 'plan_construction_template_picker_result'

export type PaymentPlanPickerResult = PickerResult<PaymentPlanTemplate>
export type ConstructionPlanPickerResult = PickerResult<ConstructionPlanTemplate>

const paymentChannel = createPickerChannel<PaymentPlanTemplate>(PAYMENT_PLAN_PICKER_KEY, (value): value is PaymentPlanTemplate => Boolean(value && typeof value === 'object' && (value as PaymentPlanTemplate).code && (value as PaymentPlanTemplate).name))
const constructionChannel = createPickerChannel<ConstructionPlanTemplate>(CONSTRUCTION_PLAN_PICKER_KEY, (value): value is ConstructionPlanTemplate => Boolean(value && typeof value === 'object' && (value as ConstructionPlanTemplate).code && (value as ConstructionPlanTemplate).name))

export function setPaymentPlanPickerResult(result: PaymentPlanPickerResult) { paymentChannel.set(result) }
export function consumePaymentPlanPickerResult() { return paymentChannel.consume() }
export function setConstructionPlanPickerResult(result: ConstructionPlanPickerResult) { constructionChannel.set(result) }
export function consumeConstructionPlanPickerResult() { return constructionChannel.consume() }
