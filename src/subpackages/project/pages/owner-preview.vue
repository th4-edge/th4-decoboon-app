<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { P } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can } from '@/roles/permission'
import { journeyApi } from '@/domains/journey/api'
import {
  activateOwnerPreviewFromQuery,
  leaveOwnerPreview,
  ownerPreviewTabUrl,
  setOwnerPreviewJourney
} from '@/domains/owner-preview/session'
import PageState from '@/components/PageState/PageState.vue'

const permissionDenied = ref(false)
const projectMissing = ref(false)
const loadError = ref('')
const projectId = ref('')

function backToProject() {
  if (!projectId.value) {
    uni.reLaunch({ url: P.projectList })
    return
  }
  leaveOwnerPreview()
}

onLoad(async (query) => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: P.login })
    return
  }
  projectId.value = query?.projectId || ''
  if (!projectId.value) {
    projectMissing.value = true
    return
  }
  if (!can(session.role, 'view:owner-preview')) {
    permissionDenied.value = true
    return
  }
  activateOwnerPreviewFromQuery({ preview: '1', projectId: projectId.value })
  try {
    const journey = await journeyApi.ownerPreviewInfo(projectId.value)
    setOwnerPreviewJourney(journey)
    // 预览入口先完成服务端项目范围校验，再进入业主真实四 Tab 首页。
    uni.redirectTo({ url: ownerPreviewTabUrl(P.home, projectId.value) })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '业主视角暂不可确认'
  }
})
</script>

<template>
  <view>
    <PageState
      v-if="permissionDenied"
      state="error"
      title="你没有该项目业主视角的预览权限"
      subtitle="请返回员工项目，或确认项目数据范围。"
      retry-text="返回员工项目"
      @retry="backToProject"
    />
    <PageState
      v-else-if="projectMissing"
      state="error"
      title="缺少项目信息"
      subtitle="请从员工项目详情进入业主视角预览。"
      retry-text="返回项目列表"
      @retry="backToProject"
    />
    <PageState
      v-else-if="loadError"
      state="error"
      title="业主视角暂不可确认"
      :subtitle="loadError"
      retry-text="返回员工项目"
      @retry="backToProject"
    />
    <PageState v-else state="loading" :rows="4" />
  </view>
</template>
