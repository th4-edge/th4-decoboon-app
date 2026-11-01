<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { absoluteUrl } from '@/core/http'
import { TOKEN_COLOR } from '@/styles/tokens'
import { contrastRatio } from '@/domains/identity/brandTheme'

const props = withDefaults(defineProps<{
  name?: string
  shortName?: string
  logo?: string
  color?: string
  size?: number
  surface?: 'auto' | 'white'
}>(), {
  name: '企业',
  shortName: '',
  logo: '',
  color: '',
  size: 72,
  surface: 'auto'
})

const failed = ref(false)
watch(() => props.logo, () => { failed.value = false })

const source = computed(() => props.logo ? absoluteUrl(props.logo) : '')
const showImage = computed(() => !!source.value && !failed.value)
const initial = computed(() => Array.from((props.shortName || props.name || '企').trim())[0] || '企')
const brandColor = computed(() => /^#[0-9a-f]{6}$/i.test(props.color || '') ? props.color! : TOKEN_COLOR.primaryBase)
// Logo 首字是大字号品牌标记，按 WCAG 大文本 3:1 阈值选择白字；默认青绿和常见深色品牌都应显示白字。
const initialColor = computed(() => props.surface === 'white'
  ? (contrastRatio(brandColor.value, '#FFFFFF') >= 3 ? brandColor.value : TOKEN_COLOR.text1)
  : (contrastRatio(brandColor.value, '#FFFFFF') >= 3 ? '#FFFFFF' : TOKEN_COLOR.text1))
const style = computed(() => ({
  width: `${props.size}rpx`,
  height: `${props.size}rpx`,
  backgroundColor: showImage.value || props.surface === 'white' ? TOKEN_COLOR.white : brandColor.value,
  borderColor: showImage.value || props.surface === 'white' ? brandColor.value : 'transparent'
}))
</script>

<template>
  <view class="company-mark" :style="style">
    <image v-if="showImage" class="company-mark__image" :src="source" mode="aspectFit" @error="failed = true" />
    <text v-else class="company-mark__initial" :style="{ color: initialColor, fontSize: `${Math.round(size * 0.42)}rpx` }">{{ initial }}</text>
  </view>
</template>

<style scoped lang="scss">
.company-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
  border: 3rpx solid transparent;
  border-radius: 28%;
}
.company-mark__image { width: 78%; height: 78%; }
.company-mark__initial { font-weight: 700; line-height: 1; }
</style>
