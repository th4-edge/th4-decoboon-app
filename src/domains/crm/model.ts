import type { Employee } from '@/domains/identity/model'

export type CustomerSource = 'lead' | 'referral' | 'walkin' | 'old' | 'video' | 'other'
export type CustomerStage = 'intention' | 'following' | 'pendingMeasure' | 'quote' | 'sign' | 'construction' | 'done' | 'lost'

export interface Customer {
  id: string
  name: string
  phone: string
  gender?: 'M' | 'F'
  source: CustomerSource
  stage: CustomerStage
  community?: string
  addr?: string
  area?: number
  budget?: number
  owner?: Employee
  designer?: Employee
  measureRequestedAt?: string
  handedOffAt?: string
  remark?: string
  lastFollowAt?: string
  nextFollowAt?: string
  wechatAdded?: boolean
  wechatNo?: string
  wechatAddedAt?: string
  visitCount?: number
  lastVisitAt?: string
  pendingMeasureAt?: string
  measureAt?: string
  projectId?: string
  createdAt?: string
}

export interface CustomerFollow {
  id: string
  customerId: string
  emp?: Employee
  way: 'phone' | 'visit' | 'wechat' | 'video' | 'other'
  content: string
  nextFollowAt?: string
  createdAt?: string
}

export interface Lead {
  id: string
  name: string
  phone: string
  source?: string
  owner?: Employee
  createdAt?: string
}

export interface Measure {
  id: string
  customerId: string
  address?: string
  area?: number
  measuredAt?: string
}
