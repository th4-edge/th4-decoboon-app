import fs from 'node:fs'
import process from 'node:process'

const files = {
  api: 'src/domains/pack/api.ts',
  page: 'src/subpackages/quote/pages/package-edit.vue'
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function validate(api, page) {
  const errors = []
  if (!api.includes("'pack/section/page'")) {
    errors.push('套餐分区必须通过 pack/section/page 读取，不能只依赖套餐项目行。')
  }
  if (!api.includes('size: 50')) {
    errors.push('套餐分区读取必须显式分页且单页不超过 50。')
  }
  if (!page.includes('const sections = ref<PackageSection[]>([])')) {
    errors.push('套餐配置页必须维护独立的分区状态。')
  }
  if (/const\s+sections\s*=\s*computed/.test(page)) {
    errors.push('禁止再从 template.items 反推套餐分区。')
  }
  if (!page.includes('packApi.sections()')) {
    errors.push('初始化或刷新套餐配置时必须读取服务端分区列表。')
  }
  if (!page.includes('const saved = await packApi.saveSection')) {
    errors.push('保存分区后必须接收服务端返回的分区并立即回显。')
  }
  if (!page.includes('请先移动或删除项目行')) {
    errors.push('有项目行的分区不得提示可直接删除。')
  }
  if (page.includes('删除后项目行将变为未分区')) {
    errors.push('前端不得承诺后端不支持的未分区删除行为。')
  }
  return errors
}

const source = { api: read(files.api), page: read(files.page) }
const errors = validate(source.api, source.page)

if (process.argv.includes('--self-test')) {
  const missingApi = validate(source.api.replace("'pack/section/page'", "'pack/section/legacy'"), source.page)
  const derivedSections = validate(
    source.api,
    source.page.replace('const sections = ref<PackageSection[]>([])', 'const sections = computed<PackageSection[]>(() => [])')
  )
  const unsafeDelete = validate(
    source.api,
    source.page.replace('请先移动或删除项目行', '删除后项目行将变为未分区')
  )
  if (!missingApi.length || !derivedSections.length || !unsafeDelete.length) {
    console.error('Package config contract self-test failed: negative fixtures were not rejected.')
    process.exit(1)
  }
  console.log('Package config contract self-test passed: 3 negative fixtures rejected.')
}

if (errors.length) {
  console.error(`Package config contract failed:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

console.log('Package config contract passed.')
