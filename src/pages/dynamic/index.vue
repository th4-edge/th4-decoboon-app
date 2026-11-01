<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { P, goTab } from '@/config'
import { isLoggedIn, session } from '@/domains/identity/session'
import { can, isCustomer } from '@/roles/permission'
import type { Project } from '@/domains/project/model'
import type { SiteReport } from '@/domains/site/model'
import { projectApi } from '@/domains/project/api'
import { consumeReportProjectPickerResult } from '@/domains/project/report-project-picker'
import { siteApi } from '@/domains/site/api'
import { visibleProjects } from '@/domains/project/scope'
import JzPageHeader from '@/components/JzPageHeader.vue'
import JzTabBar from '@/components/JzTabBar.vue'
import JzReportCard from '@/components/JzReportCard.vue'
import JzEmpty from '@/components/JzEmpty.vue'
import JzFloatAdd from '@/components/JzFloatAdd.vue'
import { toastError } from '@/composables/toast'
import OwnerPreviewBanner from '@/components/owner/OwnerPreviewBanner.vue'
import OwnerPreviewWatermark from '@/components/owner/OwnerPreviewWatermark.vue'
import {
  activateOwnerPreviewFromQuery,
  leaveOwnerPreview,
  ownerPreview,
  ownerPreviewWatermark
} from '@/domains/owner-preview/session'

const previewMode = computed(() => ownerPreview.active)
const role = computed(() => ownerPreview.active ? 'customer' as const : session.role || 'customer')
const emp = computed(() => session.emp)
const customer = computed(() => session.customer)
const projects = ref<Project[]>([])
const reports = ref<SiteReport[]>([])

onLoad((query) => {
  activateOwnerPreviewFromQuery(query)
  if (!isLoggedIn()) goTab(P.login)
})
onShow(() => {
  if (previewMode.value) uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] } as any)
  if (!isLoggedIn()) return
  const result = consumeReportProjectPickerResult()
  if (result?.action === 'select') {
    uni.navigateTo({ url: `${P.reportEdit}?projectId=${result.value.id}` })
    return
  }
  refresh()
})
onPullDownRefresh(() => refresh().finally(() => uni.stopPullDownRefresh()))

const scopedProjects = computed(() => ownerPreview.active
  ? projects.value
  : visibleProjects(projects.value, role.value, emp.value, customer.value))
const feed = computed(() => {
  const ids = scopedProjects.value.map((p) => p.id)
  return reports.value.filter((r) => ids.includes(r.projectId))
})

async function refresh() {
  try {
    if (ownerPreview.active) {
      const project = await projectApi.info(ownerPreview.projectId)
      if (project.id !== ownerPreview.projectId) throw new Error('项目范围校验失败，请返回员工项目重试')
      projects.value = [project]
      reports.value = await siteApi.reports(project.id)
      return
    }
    const [ps, rs] = await Promise.all([projectApi.list(), siteApi.allReports()])
    projects.value = ps
    reports.value = rs
  } catch (error) {
    projects.value = []
    reports.value = []
    toastError(error, '动态加载失败，请稍后重试')
  }
}

function canReport() { return can(role.value, 'act:report') }

function startReport() {
  if (!canReport()) return
  const list = scopedProjects.value
  if (!list.length) { uni.showToast({ title: '暂无可汇报项目', icon: 'none' }); return }
  if (list.length === 1) {
    uni.navigateTo({ url: `${P.reportEdit}?projectId=${list[0].id}` })
    return
  }
  uni.navigateTo({ url: P.reportProjectPicker })
}
</script>

<template>
  <view class="dy">
    <OwnerPreviewBanner v-if="previewMode" @back="leaveOwnerPreview" />
    <JzPageHeader
      title="工地动态"
      :subtitle="isCustomer(role) ? '工地现场，实时可见' : '工地现场进度实时同步给业主'"
      :right-text="canReport() ? '写汇报' : ''"
      :right-icon="canReport() ? 'edit' : undefined"
      @right="startReport"
    />

    <view class="dy__scope jz-card">
      <text class="dy__scope-label">{{ isCustomer(role) ? '我的工地动态' : '我参与的工地动态' }}</text>
      <text class="dy__scope-count">{{ feed.length }} 条</text>
    </view>

    <view class="dy__body">
      <JzReportCard v-for="r in feed" :key="r.id" :report="r" />
      <view v-if="!feed.length" class="jz-card dy__empty">
        <JzEmpty text="暂无动态" :sub="isCustomer(role) ? '项目开工后，每一步进展都会同步到这里' : '现场打卡、阶段开工、验收申请都会进入时间线'" />
      </view>
    </view>

    <JzFloatAdd v-if="canReport()" text="写汇报" @tap="startReport" />
    <JzTabBar :current="P.dynamic" />
    <OwnerPreviewWatermark v-if="previewMode" :text="ownerPreviewWatermark" />

  </view>
</template>

<style lang="scss" scoped>
.dy__scope { margin: 0 $jzb-page-pad 22rpx; padding: 24rpx; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, $jzb-text-inverse, $jzb-primary-lightest); }
.dy__scope-label { color: $jzb-text-1; font-size: $jzb-font-md; font-weight: 700; }
.dy__scope-count { padding: 8rpx 18rpx; color: $jzb-primary-dark; background: $jzb-primary-lighter; border-radius: $jzb-radius-pill; font-size: $jzb-font-sm; font-weight: 650; }
.dy__body { padding-bottom: calc($jzb-tabbar-height + $jzb-safe-bottom + 24rpx); }
.dy__empty { margin: 0 $jzb-page-pad; }
</style>
