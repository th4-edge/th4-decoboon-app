<script setup lang="ts">
import { onMounted } from 'vue'
import JzStoreFilter from '@/components/JzStoreFilter.vue'
import {
  loadStoreScope,
  setStoreScope,
  storeScope,
  storeScopeVisible
} from '@/domains/identity/storeScope'

onMounted(() => { void loadStoreScope() })

function change(value: string): void {
  setStoreScope(value)
}
</script>

<template>
  <JzStoreFilter
    :model-value="storeScope.storeId"
    :stores="storeScope.stores"
    :visible="storeScopeVisible"
    :note="storeScope.notice"
    @change="change"
  />
</template>
