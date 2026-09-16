import { post, listOf } from '@/core/http'
import type { PageResult } from '@/domains/common/model'
import type { MaterialPlan } from './model'

export const materialApi = {
  plans: async (projectId?: string) =>
    listOf(await post<PageResult<MaterialPlan> | MaterialPlan[]>('project/material-plan/page', { projectId })),
}
