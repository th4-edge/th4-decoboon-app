import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const page = read('src/subpackages/design/pages/scheme.vue')
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

// 设计分项可以只归属“综合项目”（space 为空）。此时没有区域也必须渲染分项列表，
// 不能因为 spaces.length 为 0 而落到“尚未录入区域尺寸”空态。
expect(
  page.includes('<view v-if="spaces.length || items.length" class="ds__split">'),
  '设计分项列表仍依赖区域数量，综合项目分项可能在 App 中不可见'
)
expect(page.includes("spaceId: '__unassigned__', name: '综合项目'"), '缺少综合项目分组')
expect(
  page.includes("if (activeSpaceId.value === '__unassigned__') return itemsBySpace.value.unassigned"),
  '综合项目分组未映射到未分配区域的分项'
)
expect(page.includes('const first = spaceSummaries.value[0]'), '无区域时未默认选中综合项目')

if (failures.length) {
  console.error('设计分项可见性校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('设计分项可见性校验通过：无区域时综合项目分项仍可查看')
