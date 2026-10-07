import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name)
  if (entry.isDirectory()) return walk(full)
  return [full]
})
const expect = (condition, message) => { if (!condition) failures.push(message) }

const shared = read('src/domains/file/choose-media.ts')
expect(shared.includes('chooseMedia') && shared.includes('chooseImages') && shared.includes('fail'), '统一照片选择器缺少 chooseMedia/chooseImages/fail')
expect(shared.includes('未获得相机或相册权限') && shared.includes('照片选择失败'), '统一照片选择器缺少权限或失败提示')

const files = walk(path.join(root, 'src')).filter((file) => /\.(vue|ts)$/.test(file))
const direct = files.filter((file) => !file.endsWith('domains/file/choose-media.ts') && read(path.relative(root, file)).includes('uni.chooseImage'))
expect(direct.length === 0, `仍存在页面直连 uni.chooseImage：${direct.map((f) => path.relative(root, f)).join(', ')}`)

for (const file of ['src/subpackages/customer/pages/measure-record.vue', 'src/subpackages/project/pages/report/edit.vue']) {
  const content = read(file)
  expect(content.includes('chooseImages'), `${file} 未接入统一照片选择器`)
  expect(content.includes('照片选择失败'), `${file} 缺少照片选择失败提示`)
}

if (failures.length) {
  console.error('照片选择器契约校验失败：')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}
console.log('照片选择器契约校验通过：现场汇报、量房记录及全 App 已统一 chooseMedia/chooseImages。')
