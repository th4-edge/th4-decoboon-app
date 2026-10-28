import { post } from '@/core/http'
import { toPageData, type PageData, type PageResult } from '@/domains/common/model'
import type { BossContractChangeGroup, BossContractChangeItem, BossContractChangePeriod, BossContractChangeReport, BossDesignReport, BossMeasureDesignerGroup, BossMeasureItem, BossMeasureMarketerGroup, BossMeasureReport, BossMeasureSourceGroup, BossQuoteReport, DesignWorkbenchItem, DesignerMeasureTask, QuoteWorkbenchItem, SignWorkbenchItem } from './model'

type Raw = Record<string, unknown>

function normalizeDesign(raw: Raw): DesignWorkbenchItem {
  return {
    custId: String(raw.custId ?? ''),
    propertyId: raw.propertyId ? String(raw.propertyId) : null,
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    community: String(raw.community ?? ''),
    addr: String(raw.addr ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    measureAt: raw.measureAt ? String(raw.measureAt) : null,
    pendingMeasureAt: raw.pendingMeasureAt ? String(raw.pendingMeasureAt) : null,
    designStatus: (raw.designStatus as DesignWorkbenchItem['designStatus']) || 'Pending',
    designStatusName: String(raw.designStatusName ?? ''),
    schemeCount: Number(raw.schemeCount ?? 0),
    hasRequirement: raw.hasRequirement === true,
    lastDesignAt: raw.lastDesignAt ? String(raw.lastDesignAt) : null,
    latestDesignId: raw.latestDesignId ? String(raw.latestDesignId) : null,
    latestDesignName: raw.latestDesignName ? String(raw.latestDesignName) : null,
    latestDesignStatusName: raw.latestDesignStatusName ? String(raw.latestDesignStatusName) : null,
    calculatedAmount: raw.calculatedAmount != null ? Number(raw.calculatedAmount) : null,
    currentQuoteAmount: raw.currentQuoteAmount != null ? Number(raw.currentQuoteAmount) : null,
    currentQuoteNo: raw.currentQuoteNo ? String(raw.currentQuoteNo) : null,
    currentQuoteStatusName: raw.currentQuoteStatusName ? String(raw.currentQuoteStatusName) : null,
    priceSource: raw.priceSource === 'Quote' || raw.priceSource === 'Calculated' ? raw.priceSource : 'Unavailable',
    stayDays: Number(raw.stayDays ?? 0)
  }
}

function normalizeQuote(raw: Raw): QuoteWorkbenchItem {
  return {
    custId: String(raw.custId ?? ''),
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    community: String(raw.community ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    propertyId: String(raw.propertyId ?? ''),
    quoteId: String(raw.quoteId ?? ''),
    quoteNo: String(raw.quoteNo ?? ''),
    version: Number(raw.version ?? 1),
    amount: Number(raw.amount ?? 0),
    quoteStatus: (raw.quoteStatus as QuoteWorkbenchItem['quoteStatus']) || 'Draft',
    quoteStatusName: String(raw.quoteStatusName ?? ''),
    submittedAt: raw.submittedAt ? String(raw.submittedAt) : null,
    lastFeedbackAt: raw.lastFeedbackAt ? String(raw.lastFeedbackAt) : null,
    adjustmentCount: Number(raw.adjustmentCount ?? 0),
    stayDays: Number(raw.stayDays ?? 0)
  }
}


function normalizeBossQuote(raw: Raw): BossQuoteReport {
  const customers = Array.isArray(raw.customers) ? raw.customers as Raw[] : []
  const designerGroups = Array.isArray(raw.designerGroups) ? raw.designerGroups as Raw[] : []
  return {
    asOf: raw.asOf ? String(raw.asOf) : null,
    customerCount: Number(raw.customerCount ?? 0),
    activeCustomerCount: Number(raw.activeCustomerCount ?? 0),
    pendingConfirmCustomerCount: Number(raw.pendingConfirmCustomerCount ?? 0),
    confirmedCustomerCount: Number(raw.confirmedCustomerCount ?? 0),
    riskCustomerCount: Number(raw.riskCustomerCount ?? 0),
    talkGeneratedCustomerCount: Number(raw.talkGeneratedCustomerCount ?? 0),
    quoteCount: Number(raw.quoteCount ?? 0),
    latestQuoteAmount: Number(raw.latestQuoteAmount ?? 0),
    acceptedAmount: Number(raw.acceptedAmount ?? 0),
    customers: customers.map((customer) => ({
      custId: String(customer.custId ?? ''),
      customerName: String(customer.customerName ?? ''),
      telNo: String(customer.telNo ?? ''),
      propertyCount: Number(customer.propertyCount ?? 0),
      quoteCount: Number(customer.quoteCount ?? 0),
      draftPropertyCount: Number(customer.draftPropertyCount ?? 0),
      submittedPropertyCount: Number(customer.submittedPropertyCount ?? 0),
      rejectedPropertyCount: Number(customer.rejectedPropertyCount ?? 0),
      confirmedPropertyCount: Number(customer.confirmedPropertyCount ?? 0),
      talkPropertyCount: Number(customer.talkPropertyCount ?? 0),
      riskPropertyCount: Number(customer.riskPropertyCount ?? 0),
      latestQuoteAmount: Number(customer.latestQuoteAmount ?? 0),
      acceptedAmount: Number(customer.acceptedAmount ?? 0),
      designerId: customer.designerId ? String(customer.designerId) : null,
      designerName: customer.designerName ? String(customer.designerName) : null,
      designerStoreName: customer.designerStoreName ? String(customer.designerStoreName) : null,
      nextAction: String(customer.nextAction ?? ''),
      riskLevel: (customer.riskLevel as BossQuoteReport['customers'][number]['riskLevel']) || 'Normal',
      lastActivityAt: customer.lastActivityAt ? String(customer.lastActivityAt) : null,
      properties: Array.isArray(customer.properties) ? (customer.properties as Raw[]).map((property) => ({
        propertyId: String(property.propertyId ?? ''),
        propertyNo: property.propertyNo ? String(property.propertyNo) : null,
        community: property.community ? String(property.community) : null,
        addr: property.addr ? String(property.addr) : null,
        area: property.area != null ? Number(property.area) : null,
        designerName: property.designerName ? String(property.designerName) : null,
        quoteCount: Number(property.quoteCount ?? 0),
        latestQuoteId: String(property.latestQuoteId ?? ''),
        latestQuoteNo: String(property.latestQuoteNo ?? ''),
        latestQuoteVersion: Number(property.latestQuoteVersion ?? 1),
        latestQuoteAmount: Number(property.latestQuoteAmount ?? 0),
        latestQuoteStatus: String(property.latestQuoteStatus ?? ''),
        latestQuoteStatusName: String(property.latestQuoteStatusName ?? ''),
        latestQuoteCreatedAt: property.latestQuoteCreatedAt ? String(property.latestQuoteCreatedAt) : null,
        latestQuoteSubmittedAt: property.latestQuoteSubmittedAt ? String(property.latestQuoteSubmittedAt) : null,
        latestQuoteAcceptedAt: property.latestQuoteAcceptedAt ? String(property.latestQuoteAcceptedAt) : null,
        talkCount: Number(property.talkCount ?? 0),
        latestTalkId: property.latestTalkId ? String(property.latestTalkId) : null,
        latestTalkStatus: property.latestTalkStatus ? String(property.latestTalkStatus) : null,
        latestTalkStatusName: property.latestTalkStatusName ? String(property.latestTalkStatusName) : null,
        latestTalkBuiltAt: property.latestTalkBuiltAt ? String(property.latestTalkBuiltAt) : null,
        latestTalkOutputUrl: property.latestTalkOutputUrl ? String(property.latestTalkOutputUrl) : null,
        customerConfirmed: property.customerConfirmed === true,
        customerConfirmedAt: property.customerConfirmedAt ? String(property.customerConfirmedAt) : null,
        nextAction: String(property.nextAction ?? ''),
        stayDays: Number(property.stayDays ?? 0),
        riskLevel: (property.riskLevel as BossQuotePropertyLike['riskLevel']) || 'Normal',
        history: Array.isArray(property.history) ? (property.history as Raw[]).map((history) => ({
          quoteId: String(history.quoteId ?? ''),
          quoteNo: String(history.quoteNo ?? ''),
          version: Number(history.version ?? 1),
          amount: Number(history.amount ?? 0),
          status: String(history.status ?? ''),
          statusName: String(history.statusName ?? ''),
          createdAt: history.createdAt ? String(history.createdAt) : null,
          submittedAt: history.submittedAt ? String(history.submittedAt) : null,
          acceptedAt: history.acceptedAt ? String(history.acceptedAt) : null
        })) : []
      })) : []
    })),
    designerGroups: designerGroups.map((group) => ({
      designerId: group.designerId ? String(group.designerId) : null,
      designerName: String(group.designerName ?? '待指派设计'),
      storeName: group.storeName ? String(group.storeName) : null,
      customerCount: Number(group.customerCount ?? 0),
      riskCustomerCount: Number(group.riskCustomerCount ?? 0),
      pendingConfirmCustomerCount: Number(group.pendingConfirmCustomerCount ?? 0),
      confirmedCustomerCount: Number(group.confirmedCustomerCount ?? 0),
      quoteCount: Number(group.quoteCount ?? 0),
      quoteAmount: Number(group.quoteAmount ?? 0),
      acceptedAmount: Number(group.acceptedAmount ?? 0),
      lastActivityAt: group.lastActivityAt ? String(group.lastActivityAt) : null,
      customers: Array.isArray(group.customers) ? (group.customers as Raw[]).map((customer) => ({
        custId: String(customer.custId ?? ''),
        customerName: String(customer.customerName ?? ''),
        telNo: String(customer.telNo ?? ''),
        propertyCount: Number(customer.propertyCount ?? 0),
        quoteCount: Number(customer.quoteCount ?? 0),
        draftPropertyCount: Number(customer.draftPropertyCount ?? 0),
        submittedPropertyCount: Number(customer.submittedPropertyCount ?? 0),
        rejectedPropertyCount: Number(customer.rejectedPropertyCount ?? 0),
        confirmedPropertyCount: Number(customer.confirmedPropertyCount ?? 0),
        talkPropertyCount: Number(customer.talkPropertyCount ?? 0),
        riskPropertyCount: Number(customer.riskPropertyCount ?? 0),
        latestQuoteAmount: Number(customer.latestQuoteAmount ?? 0),
        acceptedAmount: Number(customer.acceptedAmount ?? 0),
        designerId: customer.designerId ? String(customer.designerId) : null,
        designerName: customer.designerName ? String(customer.designerName) : null,
        designerStoreName: customer.designerStoreName ? String(customer.designerStoreName) : null,
        nextAction: String(customer.nextAction ?? ''),
        riskLevel: (customer.riskLevel as BossQuoteReport['customers'][number]['riskLevel']) || 'Normal',
        lastActivityAt: customer.lastActivityAt ? String(customer.lastActivityAt) : null,
        properties: Array.isArray(customer.properties) ? (customer.properties as Raw[]).map((property) => ({
          propertyId: String(property.propertyId ?? ''),
          propertyNo: property.propertyNo ? String(property.propertyNo) : null,
          community: property.community ? String(property.community) : null,
          addr: property.addr ? String(property.addr) : null,
          area: property.area != null ? Number(property.area) : null,
          designerName: property.designerName ? String(property.designerName) : null,
          quoteCount: Number(property.quoteCount ?? 0),
          latestQuoteId: String(property.latestQuoteId ?? ''),
          latestQuoteNo: String(property.latestQuoteNo ?? ''),
          latestQuoteVersion: Number(property.latestQuoteVersion ?? 1),
          latestQuoteAmount: Number(property.latestQuoteAmount ?? 0),
          latestQuoteStatus: String(property.latestQuoteStatus ?? ''),
          latestQuoteStatusName: String(property.latestQuoteStatusName ?? ''),
          latestQuoteCreatedAt: property.latestQuoteCreatedAt ? String(property.latestQuoteCreatedAt) : null,
          latestQuoteSubmittedAt: property.latestQuoteSubmittedAt ? String(property.latestQuoteSubmittedAt) : null,
          latestQuoteAcceptedAt: property.latestQuoteAcceptedAt ? String(property.latestQuoteAcceptedAt) : null,
          talkCount: Number(property.talkCount ?? 0),
          latestTalkId: property.latestTalkId ? String(property.latestTalkId) : null,
          latestTalkStatus: property.latestTalkStatus ? String(property.latestTalkStatus) : null,
          latestTalkStatusName: property.latestTalkStatusName ? String(property.latestTalkStatusName) : null,
          latestTalkBuiltAt: property.latestTalkBuiltAt ? String(property.latestTalkBuiltAt) : null,
          latestTalkOutputUrl: property.latestTalkOutputUrl ? String(property.latestTalkOutputUrl) : null,
          customerConfirmed: property.customerConfirmed === true,
          customerConfirmedAt: property.customerConfirmedAt ? String(property.customerConfirmedAt) : null,
          nextAction: String(property.nextAction ?? ''),
          stayDays: Number(property.stayDays ?? 0),
          riskLevel: (property.riskLevel as BossQuotePropertyLike['riskLevel']) || 'Normal',
          history: Array.isArray(property.history) ? (property.history as Raw[]).map((history) => ({
            quoteId: String(history.quoteId ?? ''),
            quoteNo: String(history.quoteNo ?? ''),
            version: Number(history.version ?? 1),
            amount: Number(history.amount ?? 0),
            status: String(history.status ?? ''),
            statusName: String(history.statusName ?? ''),
            createdAt: history.createdAt ? String(history.createdAt) : null,
            submittedAt: history.submittedAt ? String(history.submittedAt) : null,
            acceptedAt: history.acceptedAt ? String(history.acceptedAt) : null
          })) : []
        })) : []
      })) : []
    }))
  }
}

type BossQuotePropertyLike = BossQuoteReport['customers'][number]['properties'][number]

function normalizeBossDesign(raw: Raw): BossDesignReport {
  const designers = Array.isArray(raw.designers) ? raw.designers as Raw[] : []
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  return {
    asOf: raw.asOf ? String(raw.asOf) : null,
    pipelineCount: Number(raw.pipelineCount ?? 0),
    unassignedCount: Number(raw.unassignedCount ?? 0),
    requirementPendingCount: Number(raw.requirementPendingCount ?? 0),
    schemePendingCount: Number(raw.schemePendingCount ?? 0),
    designingCount: Number(raw.designingCount ?? 0),
    quoteDraftCount: Number(raw.quoteDraftCount ?? 0),
    quoteSubmittedCount: Number(raw.quoteSubmittedCount ?? 0),
    confirmedCount: Number(raw.confirmedCount ?? 0),
    contractedCount: Number(raw.contractedCount ?? 0),
    talkGeneratedCount: Number(raw.talkGeneratedCount ?? 0),
    riskCount: Number(raw.riskCount ?? 0),
    quoteAmount: Number(raw.quoteAmount ?? 0),
    acceptedAmount: Number(raw.acceptedAmount ?? 0),
    designers: designers.map((item) => ({
      designerId: String(item.designerId ?? ''),
      designerName: String(item.designerName ?? ''),
      storeName: item.storeName ? String(item.storeName) : null,
      customerCount: Number(item.customerCount ?? 0),
      schemeCount: Number(item.schemeCount ?? 0),
      quoteCount: Number(item.quoteCount ?? 0),
      talkCount: Number(item.talkCount ?? 0),
      confirmedCount: Number(item.confirmedCount ?? 0),
      riskCount: Number(item.riskCount ?? 0),
      quoteAmount: Number(item.quoteAmount ?? 0),
      acceptedAmount: Number(item.acceptedAmount ?? 0),
      lastUpdateAt: item.lastUpdateAt ? String(item.lastUpdateAt) : null
    })),
    items: items.map((item) => ({
      custId: String(item.custId ?? ''),
      propertyId: String(item.propertyId ?? ''),
      customerName: String(item.customerName ?? ''),
      telNo: String(item.telNo ?? ''),
      community: item.community ? String(item.community) : undefined,
      addr: item.addr ? String(item.addr) : undefined,
      area: item.area != null ? Number(item.area) : null,
      designerId: item.designerId ? String(item.designerId) : null,
      designerName: item.designerName ? String(item.designerName) : null,
      designerStoreName: item.designerStoreName ? String(item.designerStoreName) : null,
      measureAt: item.measureAt ? String(item.measureAt) : null,
      pendingMeasureAt: item.pendingMeasureAt ? String(item.pendingMeasureAt) : null,
      stage: String(item.stage ?? ''),
      stageName: String(item.stageName ?? ''),
      nextAction: String(item.nextAction ?? ''),
      stayDays: Number(item.stayDays ?? 0),
      riskLevel: (item.riskLevel as BossDesignReport['items'][number]['riskLevel']) || 'Normal',
      requirementCount: Number(item.requirementCount ?? 0),
      latestRequirementTitle: item.latestRequirementTitle ? String(item.latestRequirementTitle) : null,
      schemeCount: Number(item.schemeCount ?? 0),
      latestSchemeId: item.latestSchemeId ? String(item.latestSchemeId) : null,
      latestSchemeNo: item.latestSchemeNo ? String(item.latestSchemeNo) : null,
      latestSchemeName: item.latestSchemeName ? String(item.latestSchemeName) : null,
      latestSchemeStatus: item.latestSchemeStatus ? String(item.latestSchemeStatus) : null,
      latestSchemeStatusName: item.latestSchemeStatusName ? String(item.latestSchemeStatusName) : null,
      latestSchemeSpaceCount: Number(item.latestSchemeSpaceCount ?? 0),
      latestSchemeItemCount: Number(item.latestSchemeItemCount ?? 0),
      latestDesignAt: item.latestDesignAt ? String(item.latestDesignAt) : null,
      quoteCount: Number(item.quoteCount ?? 0),
      latestQuoteId: item.latestQuoteId ? String(item.latestQuoteId) : null,
      latestQuoteNo: item.latestQuoteNo ? String(item.latestQuoteNo) : null,
      latestQuoteVersion: item.latestQuoteVersion != null ? Number(item.latestQuoteVersion) : null,
      latestQuoteAmount: item.latestQuoteAmount != null ? Number(item.latestQuoteAmount) : null,
      latestQuoteStatus: item.latestQuoteStatus ? String(item.latestQuoteStatus) : null,
      latestQuoteStatusName: item.latestQuoteStatusName ? String(item.latestQuoteStatusName) : null,
      latestQuoteSubmittedAt: item.latestQuoteSubmittedAt ? String(item.latestQuoteSubmittedAt) : null,
      latestQuoteAcceptedAt: item.latestQuoteAcceptedAt ? String(item.latestQuoteAcceptedAt) : null,
      talkCount: Number(item.talkCount ?? 0),
      latestTalkId: item.latestTalkId ? String(item.latestTalkId) : null,
      latestTalkNo: item.latestTalkNo ? String(item.latestTalkNo) : null,
      latestTalkStatus: item.latestTalkStatus ? String(item.latestTalkStatus) : null,
      latestTalkStatusName: item.latestTalkStatusName ? String(item.latestTalkStatusName) : null,
      latestTalkBuiltAt: item.latestTalkBuiltAt ? String(item.latestTalkBuiltAt) : null,
      latestTalkOutputUrl: item.latestTalkOutputUrl ? String(item.latestTalkOutputUrl) : null,
      customerConfirmed: item.customerConfirmed === true,
      customerConfirmedAt: item.customerConfirmedAt ? String(item.customerConfirmedAt) : null
    }))
  }
}

function normalizeSign(raw: Raw): SignWorkbenchItem {
  return {
    custId: String(raw.custId ?? ''),
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    community: String(raw.community ?? ''),
    addr: String(raw.addr ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    propertyId: String(raw.propertyId ?? ''),
    quoteId: String(raw.quoteId ?? ''),
    quoteNo: String(raw.quoteNo ?? ''),
    version: Number(raw.version ?? 1),
    acceptedAmount: Number(raw.acceptedAmount ?? 0),
    acceptedAt: raw.acceptedAt ? String(raw.acceptedAt) : null,
    converted: raw.converted === true,
    contractId: raw.contractId ? String(raw.contractId) : null,
    contractStatus: String(raw.contractStatus ?? ''),
    contractStatusName: String(raw.contractStatusName ?? ''),
    signedAt: raw.signedAt ? String(raw.signedAt) : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    projectName: raw.projectName ? String(raw.projectName) : null,
    projectStatus: raw.projectStatus ? String(raw.projectStatus) : null,
    projectStatusName: raw.projectStatusName ? String(raw.projectStatusName) : null,
    currentAmount: raw.currentAmount == null ? null : Number(raw.currentAmount),
    pendingChangeCount: raw.pendingChangeCount == null ? null : Number(raw.pendingChangeCount),
    designerId: raw.designerId ? String(raw.designerId) : null,
    designerName: raw.designerName ? String(raw.designerName) : null,
    designerStoreName: raw.designerStoreName ? String(raw.designerStoreName) : null,
    stayDays: Number(raw.stayDays ?? 0)
  }
}


function normalizeBossMeasureItem(raw: Raw): BossMeasureItem {
  return {
    measureId: raw.measureId ? String(raw.measureId) : null,
    customerId: String(raw.customerId ?? ''),
    propertyId: String(raw.propertyId ?? ''),
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    source: String(raw.source ?? 'Other'),
    sourceName: String(raw.sourceName ?? '其他'),
    marketerId: raw.marketerId ? String(raw.marketerId) : null,
    marketerName: raw.marketerName ? String(raw.marketerName) : null,
    marketerStoreName: raw.marketerStoreName ? String(raw.marketerStoreName) : null,
    community: raw.community ? String(raw.community) : null,
    building: raw.building ? String(raw.building) : null,
    roomNo: raw.roomNo ? String(raw.roomNo) : null,
    address: raw.address ? String(raw.address) : null,
    area: raw.area == null ? null : Number(raw.area),
    layout: raw.layout ? String(raw.layout) : null,
    propertyStatus: raw.propertyStatus ? String(raw.propertyStatus) : null,
    propertyStatusName: raw.propertyStatusName ? String(raw.propertyStatusName) : null,
    designerId: raw.designerId ? String(raw.designerId) : null,
    designerName: raw.designerName ? String(raw.designerName) : null,
    executorId: raw.executorId ? String(raw.executorId) : null,
    executorName: raw.executorName ? String(raw.executorName) : null,
    scheduledAt: raw.scheduledAt ? String(raw.scheduledAt) : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    measureStatus: raw.measureStatus ? String(raw.measureStatus) : null,
    derivedState: String(raw.derivedState ?? 'NotScheduled'),
    derivedStateName: String(raw.derivedStateName ?? '未预约量房'),
    riskLevel: (raw.riskLevel as BossMeasureItem['riskLevel']) || 'Normal',
    nextAction: String(raw.nextAction ?? ''),
    sitePhotoCount: Number(raw.sitePhotoCount ?? 0),
    structureImageCount: Number(raw.structureImageCount ?? 0),
    attachmentCount: Number(raw.attachmentCount ?? 0),
    handoffStarted: raw.handoffStarted === true,
    handoffStartedAt: raw.handoffStartedAt ? String(raw.handoffStartedAt) : null,
    stayHours: raw.stayHours == null ? null : Number(raw.stayHours)
  }
}

function normalizeBossMeasureMarketer(raw: Raw): BossMeasureMarketerGroup {
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  return {
    marketerId: raw.marketerId ? String(raw.marketerId) : null,
    marketerName: String(raw.marketerName ?? '未分配业务员'),
    storeName: raw.storeName ? String(raw.storeName) : null,
    itemCount: Number(raw.itemCount ?? 0),
    notScheduledCount: Number(raw.notScheduledCount ?? 0),
    scheduledCount: Number(raw.scheduledCount ?? 0),
    completedCount: Number(raw.completedCount ?? 0),
    overdue4hCount: Number(raw.overdue4hCount ?? 0),
    unassignedCount: Number(raw.unassignedCount ?? 0),
    appointmentRate: raw.appointmentRate == null ? null : Number(raw.appointmentRate),
    completionRate: raw.completionRate == null ? null : Number(raw.completionRate),
    overdueRate: raw.overdueRate == null ? null : Number(raw.overdueRate),
    items: items.map(normalizeBossMeasureItem)
  }
}

function normalizeBossMeasureSource(raw: Raw): BossMeasureSourceGroup {
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  return {
    source: String(raw.source ?? 'Other'),
    sourceName: String(raw.sourceName ?? '其他'),
    itemCount: Number(raw.itemCount ?? 0),
    scheduledCount: Number(raw.scheduledCount ?? 0),
    completedCount: Number(raw.completedCount ?? 0),
    handoffCount: Number(raw.handoffCount ?? 0),
    appointmentRate: raw.appointmentRate == null ? null : Number(raw.appointmentRate),
    completionRate: raw.completionRate == null ? null : Number(raw.completionRate),
    handoffRate: raw.handoffRate == null ? null : Number(raw.handoffRate),
    items: items.map(normalizeBossMeasureItem)
  }
}

function normalizeBossMeasureDesigner(raw: Raw): BossMeasureDesignerGroup {
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  return {
    designerId: String(raw.designerId ?? ''),
    designerName: String(raw.designerName ?? '未指派'),
    storeName: raw.storeName ? String(raw.storeName) : null,
    scheduledCount: Number(raw.scheduledCount ?? 0),
    completedCount: Number(raw.completedCount ?? 0),
    overdue4hCount: Number(raw.overdue4hCount ?? 0),
    items: items.map(normalizeBossMeasureItem)
  }
}

function normalizeBossMeasure(raw: Raw): BossMeasureReport {
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  const marketerGroups = Array.isArray(raw.marketerGroups) ? raw.marketerGroups as Raw[] : []
  const sourceGroups = Array.isArray(raw.sourceGroups) ? raw.sourceGroups as Raw[] : []
  const designerGroups = Array.isArray(raw.designerGroups) ? raw.designerGroups as Raw[] : []
  const periods = Array.isArray(raw.periods) ? raw.periods as Raw[] : []
  return {
    asOf: raw.asOf ? String(raw.asOf) : null,
    itemCount: Number(raw.itemCount ?? 0),
    todayCount: Number(raw.todayCount ?? 0),
    riskCount: Number(raw.riskCount ?? 0),
    scheduledCount: Number(raw.scheduledCount ?? 0),
    appointmentRate: raw.appointmentRate == null ? null : Number(raw.appointmentRate),
    completedCount: Number(raw.completedCount ?? 0),
    completionRate: raw.completionRate == null ? null : Number(raw.completionRate),
    overdue4hCount: Number(raw.overdue4hCount ?? 0),
    overdueRate: raw.overdueRate == null ? null : Number(raw.overdueRate),
    handoffCount: Number(raw.handoffCount ?? 0),
    handoffRate: raw.handoffRate == null ? null : Number(raw.handoffRate),
    unassignedCount: Number(raw.unassignedCount ?? 0),
    handoff48hCount: Number(raw.handoff48hCount ?? 0),
    periods: periods.map((period) => ({
      key: String(period.key ?? ''),
      label: String(period.label ?? ''),
      scheduledCount: Number(period.scheduledCount ?? 0),
      completedCount: Number(period.completedCount ?? 0)
    })),
    items: items.map(normalizeBossMeasureItem),
    marketerGroups: marketerGroups.map(normalizeBossMeasureMarketer),
    sourceGroups: sourceGroups.map(normalizeBossMeasureSource),
    designerGroups: designerGroups.map(normalizeBossMeasureDesigner)
  }
}


function numberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value)
}

function boolValue(value: unknown): boolean {
  return value === true
}

function normalizeBossContractChangeItem(raw: Raw): BossContractChangeItem {
  return {
    changeId: String(raw.changeId ?? ''),
    changeNo: String(raw.changeNo ?? ''),
    status: (raw.status as BossContractChangeItem['status']) || 'pending',
    statusName: String(raw.statusName ?? ''),
    type: String(raw.type ?? ''),
    typeName: String(raw.typeName ?? ''),
    projectId: raw.projectId ? String(raw.projectId) : null,
    projectNo: raw.projectNo ? String(raw.projectNo) : null,
    projectName: raw.projectName ? String(raw.projectName) : null,
    projectStatus: raw.projectStatus ? String(raw.projectStatus) : null,
    customerName: raw.customerName ? String(raw.customerName) : null,
    community: raw.community ? String(raw.community) : null,
    building: raw.building ? String(raw.building) : null,
    roomNo: raw.roomNo ? String(raw.roomNo) : null,
    address: raw.address ? String(raw.address) : null,
    contractId: raw.contractId ? String(raw.contractId) : null,
    contractNo: raw.contractNo ? String(raw.contractNo) : null,
    contractCurrentAmount: numberOrNull(raw.contractCurrentAmount),
    projectedContractAmount: numberOrNull(raw.projectedContractAmount),
    amount: Number(raw.amount ?? 0),
    costDelta: numberOrNull(raw.costDelta),
    projectedGrossProfit: numberOrNull(raw.projectedGrossProfit),
    projectedGrossMargin: numberOrNull(raw.projectedGrossMargin),
    costComplete: raw.costComplete == null ? null : boolValue(raw.costComplete),
    itemCount: Number(raw.itemCount ?? 0),
    constructionItemCount: Number(raw.constructionItemCount ?? 0),
    materialItemCount: Number(raw.materialItemCount ?? 0),
    materialPendingCount: Number(raw.materialPendingCount ?? 0),
    materialOrderedCount: Number(raw.materialOrderedCount ?? 0),
    requestedById: raw.requestedById ? String(raw.requestedById) : null,
    requestedByName: raw.requestedByName ? String(raw.requestedByName) : null,
    approvedById: raw.approvedById ? String(raw.approvedById) : null,
    approvedByName: raw.approvedByName ? String(raw.approvedByName) : null,
    createTime: raw.createTime ? String(raw.createTime) : null,
    approvedAt: raw.approvedAt ? String(raw.approvedAt) : null,
    customerConfirmedAt: raw.customerConfirmedAt ? String(raw.customerConfirmedAt) : null,
    waitingHours: Number(raw.waitingHours ?? 0),
    riskLevel: (raw.riskLevel as BossContractChangeItem['riskLevel']) || 'low',
    riskText: String(raw.riskText ?? ''),
    nextAction: String(raw.nextAction ?? ''),
    lineSummary: raw.lineSummary ? String(raw.lineSummary) : null,
    evidenceImageCount: Number(raw.evidenceImageCount ?? 0),
    hasSignature: boolValue(raw.hasSignature)
  }
}

function normalizeBossContractChangeGroup(raw: Raw): BossContractChangeGroup {
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  return {
    projectId: String(raw.projectId ?? ''),
    projectNo: raw.projectNo ? String(raw.projectNo) : null,
    projectName: String(raw.projectName ?? '未命名项目'),
    projectStatus: raw.projectStatus ? String(raw.projectStatus) : null,
    customerName: raw.customerName ? String(raw.customerName) : null,
    community: raw.community ? String(raw.community) : null,
    building: raw.building ? String(raw.building) : null,
    roomNo: raw.roomNo ? String(raw.roomNo) : null,
    address: raw.address ? String(raw.address) : null,
    contractId: raw.contractId ? String(raw.contractId) : null,
    contractNo: raw.contractNo ? String(raw.contractNo) : null,
    contractCurrentAmount: numberOrNull(raw.contractCurrentAmount),
    inFlightAmount: numberOrNull(raw.inFlightAmount),
    projectedContractAmount: numberOrNull(raw.projectedContractAmount),
    totalCount: Number(raw.totalCount ?? 0),
    pendingCount: Number(raw.pendingCount ?? 0),
    approvedCount: Number(raw.approvedCount ?? 0),
    confirmedCount: Number(raw.confirmedCount ?? 0),
    pendingAmount: Number(raw.pendingAmount ?? 0),
    confirmedNetAmount: Number(raw.confirmedNetAmount ?? 0),
    costDelta: numberOrNull(raw.costDelta),
    projectedGrossProfit: numberOrNull(raw.projectedGrossProfit),
    projectedGrossMargin: numberOrNull(raw.projectedGrossMargin),
    costComplete: raw.costComplete == null ? null : boolValue(raw.costComplete),
    materialPendingCount: Number(raw.materialPendingCount ?? 0),
    materialOrderedCount: Number(raw.materialOrderedCount ?? 0),
    riskCount: Number(raw.riskCount ?? 0),
    riskLevel: (raw.riskLevel as BossContractChangeGroup['riskLevel']) || 'low',
    riskText: raw.riskText ? String(raw.riskText) : null,
    receivableGenerated: boolValue(raw.receivableGenerated),
    receivableTotal: Number(raw.receivableTotal ?? 0),
    receivableReceivedTotal: Number(raw.receivableReceivedTotal ?? 0),
    receivableOutstandingTotal: Number(raw.receivableOutstandingTotal ?? 0),
    receivableOverdueTotal: Number(raw.receivableOverdueTotal ?? 0),
    receivableOverdueCount: Number(raw.receivableOverdueCount ?? 0),
    items: items.map(normalizeBossContractChangeItem)
  }
}

function normalizeBossContractChangePeriod(raw: Raw): BossContractChangePeriod {
  return {
    key: String(raw.key ?? ''),
    label: String(raw.label ?? ''),
    createdCount: Number(raw.createdCount ?? 0),
    confirmedCount: Number(raw.confirmedCount ?? 0),
    confirmedAmount: Number(raw.confirmedAmount ?? 0)
  }
}

function normalizeBossContractChangeReport(raw: Raw): BossContractChangeReport {
  const periods = Array.isArray(raw.periods) ? raw.periods as Raw[] : []
  const groups = Array.isArray(raw.groups) ? raw.groups as Raw[] : []
  const items = Array.isArray(raw.items) ? raw.items as Raw[] : []
  return {
    asOf: raw.asOf ? String(raw.asOf) : null,
    itemCount: Number(raw.itemCount ?? 0),
    pendingCount: Number(raw.pendingCount ?? 0),
    pendingAmount: Number(raw.pendingAmount ?? 0),
    approvedCount: Number(raw.approvedCount ?? 0),
    approvedAmount: Number(raw.approvedAmount ?? 0),
    confirmedCount: Number(raw.confirmedCount ?? 0),
    confirmedNetAmount: Number(raw.confirmedNetAmount ?? 0),
    thisMonthConfirmedCount: Number(raw.thisMonthConfirmedCount ?? 0),
    thisMonthConfirmedAmount: Number(raw.thisMonthConfirmedAmount ?? 0),
    rejectedCount: Number(raw.rejectedCount ?? 0),
    cancelledCount: Number(raw.cancelledCount ?? 0),
    confirmedCostDelta: numberOrNull(raw.confirmedCostDelta),
    projectedContractAmount: Number(raw.projectedContractAmount ?? 0),
    projectedGrossProfit: numberOrNull(raw.projectedGrossProfit),
    projectedGrossMargin: numberOrNull(raw.projectedGrossMargin),
    costVisible: boolValue(raw.costVisible),
    overdueApprovalCount: Number(raw.overdueApprovalCount ?? 0),
    overdueConfirmCount: Number(raw.overdueConfirmCount ?? 0),
    materialPendingCount: Number(raw.materialPendingCount ?? 0),
    materialOrderedCount: Number(raw.materialOrderedCount ?? 0),
    costIncompleteCount: numberOrNull(raw.costIncompleteCount),
    receivableGenerated: boolValue(raw.receivableGenerated),
    receivableOverdueCount: Number(raw.receivableOverdueCount ?? 0),
    receivableChangeTotal: Number(raw.receivableChangeTotal ?? 0),
    receivableReceivedTotal: Number(raw.receivableReceivedTotal ?? 0),
    receivableOutstandingTotal: Number(raw.receivableOutstandingTotal ?? 0),
    receivableOverdueTotal: Number(raw.receivableOverdueTotal ?? 0),
    periods: periods.map(normalizeBossContractChangePeriod),
    groups: groups.map(normalizeBossContractChangeGroup),
    items: items.map(normalizeBossContractChangeItem)
  }
}

function normalizeDesignerMeasureTask(raw: Raw): DesignerMeasureTask {
  return {
    taskKey: String(raw.taskKey ?? ''),
    customerId: String(raw.customerId ?? ''),
    customerName: String(raw.customerName ?? ''),
    telNo: String(raw.telNo ?? ''),
    customerStatus: String(raw.customerStatus ?? ''),
    customerStatusName: String(raw.customerStatusName ?? ''),
    propertyId: raw.propertyId ? String(raw.propertyId) : null,
    propertyLabel: String(raw.propertyLabel ?? ''),
    community: String(raw.community ?? ''),
    building: String(raw.building ?? ''),
    roomNo: String(raw.roomNo ?? ''),
    address: String(raw.address ?? ''),
    area: raw.area != null ? Number(raw.area) : null,
    layout: String(raw.layout ?? ''),
    propertyStatus: String(raw.propertyStatus ?? ''),
    propertyStatusName: String(raw.propertyStatusName ?? ''),
    measureId: raw.measureId ? String(raw.measureId) : null,
    measureStatus: raw.measureStatus ? String(raw.measureStatus) : null,
    scheduledAt: raw.scheduledAt ? String(raw.scheduledAt) : null,
    scheduleStateKey: raw.scheduleStateKey ? String(raw.scheduleStateKey) : null,
    scheduleStateName: raw.scheduleStateName ? String(raw.scheduleStateName) : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    stateKey: String(raw.stateKey ?? ''),
    stateLabel: String(raw.stateLabel ?? '状态暂不可确认'),
    riskLevel: String(raw.riskLevel ?? 'Normal'),
    riskReason: String(raw.riskReason ?? ''),
    mainActionKey: String(raw.mainActionKey ?? ''),
    mainActionLabel: String(raw.mainActionLabel ?? '暂不可执行'),
    nextActionKey: raw.nextActionKey ? String(raw.nextActionKey) : null,
    nextActionLabel: raw.nextActionLabel ? String(raw.nextActionLabel) : null,
    secondaryActionKey: raw.secondaryActionKey ? String(raw.secondaryActionKey) : null,
    secondaryActionLabel: raw.secondaryActionLabel ? String(raw.secondaryActionLabel) : null,
    completionHint: raw.completionHint ? String(raw.completionHint) : null,
    route: raw.route ? String(raw.route) : null,
    allowed: raw.allowed !== false,
    blockReason: raw.blockReason ? String(raw.blockReason) : null,
    sitePhotoCount: Number(raw.sitePhotoCount ?? 0),
    structureImageCount: Number(raw.structureImageCount ?? 0),
    attachmentCount: Number(raw.attachmentCount ?? 0),
    requirementCount: Number(raw.requirementCount ?? 0),
    designCount: Number(raw.designCount ?? 0),
    priority: Number(raw.priority ?? 0)
  }
}

export const workbenchApi = {
  /** 企业负责人报价谈单客户经营报告 */
  bossQuote: async (): Promise<BossQuoteReport> => {
    const raw = await post<Raw>('statistic/boss/quote/report', {})
    return normalizeBossQuote(raw || {})
  },
  /** 企业负责人量房经营与预约转化报告 */
  bossMeasure: async (query: Record<string, unknown> = {}): Promise<BossMeasureReport> => {
    const raw = await post<Raw>('statistic/boss/measure/report', query)
    return normalizeBossMeasure(raw || {})
  },
  /** 企业负责人增减项经营工作台报告 */
  bossContractChange: async (query: Record<string, unknown> = {}): Promise<BossContractChangeReport> => {
    const raw = await post<Raw>('statistic/boss/contract-change/report', query)
    return normalizeBossContractChangeReport(raw || {})
  },
  /** 企业负责人设计方案经营报告 */
  bossDesign: async (): Promise<BossDesignReport> => {
    const raw = await post<Raw>('statistic/boss/design/report', {})
    return normalizeBossDesign(raw || {})
  },
  /** 设计师待量房：关键词、状态、排序和分页均由服务端完成。 */
  measurePage: async (query: { current?: number; size?: number; keyword?: string; state?: string } = {}): Promise<PageData<DesignerMeasureTask>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const raw = await post<PageResult<Raw> | Raw[]>('statistic/designer/measure/page', {
      current,
      size,
      keyword: query.keyword?.trim() || undefined,
      state: query.state || undefined
    })
    const page = toPageData(raw, current, size)
    return { ...page, list: page.list.map(normalizeDesignerMeasureTask) }
  },

  /** 设计工作台：服务端完成资格筛选、关键词、设计状态和分页。 */
  design: async (query: { current?: number; size?: number; keyword?: string; filter?: string } = {}): Promise<PageData<DesignWorkbenchItem>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const raw = await post<PageResult<Raw> | Raw[]>('statistic/workbench/design/page', {
      current,
      size,
      keyword: query.keyword?.trim() || undefined,
      filter: query.filter || 'all'
    })
    const page = toPageData(raw, current, size)
    return { ...page, list: page.list.map(normalizeDesign) }
  },

  /** 报价工作台：服务端分页、筛选并排除 Dormant 客户。 */
  quote: async (query: { current?: number; size?: number; filter?: string; keyword?: string; quoteId?: string } = {}): Promise<PageData<QuoteWorkbenchItem>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const raw = await post<PageResult<Raw> | Raw[]>('statistic/workbench/quote/page', {
      current,
      size,
      filter: query.filter || 'all',
      keyword: query.keyword?.trim() || undefined,
      quoteId: query.quoteId || undefined
    })
    const page = toPageData(raw, current, size)
    return { ...page, list: page.list.map(normalizeQuote) }
  },

  /** 签约工作台：服务端分页、筛选并排除 Dormant 客户。 */
  sign: async (query: { current?: number; size?: number; filter?: string; keyword?: string; quoteId?: string } = {}): Promise<PageData<SignWorkbenchItem>> => {
    const current = query.current ?? 1
    const size = query.size ?? 20
    const raw = await post<PageResult<Raw> | Raw[]>('statistic/workbench/sign/page', {
      current,
      size,
      filter: query.filter || 'all',
      keyword: query.keyword?.trim() || undefined,
      quoteId: query.quoteId || undefined
    })
    const page = toPageData(raw, current, size)
    return { ...page, list: page.list.map(normalizeSign) }
  }
}
