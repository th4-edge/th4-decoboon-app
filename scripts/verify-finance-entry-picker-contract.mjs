import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative) => fs.existsSync(path.join(root, relative))
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const pagesJson = JSON.parse(read('src/pages.json'))
const financePackage = (pagesJson.subPackages || []).find((item) => item.root === 'subpackages/finance')
const financePages = (financePackage?.pages || []).map((item) => item.path)
const config = read('src/config/index.ts')
const guard = read('src/roles/guard.ts')
const entry = read('src/subpackages/finance/pages/entry.vue')
const receivable = read('src/subpackages/finance/pages/receivable-picker.vue')
const payable = read('src/subpackages/finance/pages/payable-picker.vue')

expect(exists('src/subpackages/finance/pages/receivable-picker.vue'), '缺少应收节点选择页')
expect(exists('src/subpackages/finance/pages/payable-picker.vue'), '缺少应付单选择页')
expect(financePages.includes('pages/receivable-picker'), 'pages.json 未登记应收节点选择页')
expect(financePages.includes('pages/payable-picker'), 'pages.json 未登记应付单选择页')
expect(config.includes("financeReceivablePicker: '/subpackages/finance/pages/receivable-picker'"), '缺少应收选择路由常量')
expect(config.includes("financePayablePicker: '/subpackages/finance/pages/payable-picker'"), '缺少应付选择路由常量')
expect(guard.includes('P.financeReceivablePicker'), '应收选择页缺少路由权限规则')
expect(guard.includes('P.financePayablePicker'), '应付选择页缺少路由权限规则')

expect(entry.includes('consumeFinanceReceivablePickerResult'), '登记表单未消费应收选择结果')
expect(entry.includes('consumeFinancePayablePickerResult'), '登记表单未消费应付选择结果')
expect(entry.includes('openReceivablePicker'), '登记表单缺少应收选择页入口')
expect(entry.includes('openPayablePicker'), '登记表单缺少应付选择页入口')
expect(entry.includes("待收余额"), '登记表单缺少应收摘要卡')
expect(entry.includes("待付余额"), '登记表单缺少应付摘要卡')
expect(entry.includes("请先选择项目"), '未选项目点应收节点缺少前置引导')
expect(entry.includes("该项目还没有应收节点"), '应收无数据缺少内联空态')
expect(entry.includes("该项目应收已全部收清"), '应收全部收清缺少内联空态')
expect(entry.includes("当前没有待付应付单"), '应付无数据缺少内联空态')
expect(entry.includes("应付账款已全部结清"), '应付全部结清缺少内联空态')
expect(!entry.includes('receivableOptions'), '登记表单仍残留应收原生 picker 选项')
expect(!entry.includes('payableOptions'), '登记表单仍残留应付原生 picker 选项')
expect(!entry.includes('<picker :range="receivableOptions"'), '登记表单仍使用应收原生 picker')
expect(!entry.includes('<picker :range="payableOptions"'), '登记表单仍使用应付原生 picker')

expect(receivable.includes('setFinanceReceivablePickerResult'), '应收选择页未写回一次性结果')
expect(payable.includes('setFinancePayablePickerResult'), '应付选择页未写回一次性结果')
expect(receivable.includes('显示已收清'), '应收选择页缺少已结清开关')
expect(payable.includes('显示已付清'), '应付选择页缺少已结清开关')
expect(receivable.includes('该节点已收清，不能再次核销'), '应收选择页缺少已结清不可核销提示')
expect(payable.includes('该应付单已结清，不能再次核销'), '应付选择页缺少已结清不可核销提示')
expect(receivable.includes('PageState') && receivable.includes('JzSkeleton'), '应收选择页缺少错误态或骨架屏')
expect(payable.includes('PageState') && payable.includes('JzSkeleton'), '应付选择页缺少错误态或骨架屏')
expect(receivable.includes('ListFooter') && payable.includes('ListFooter'), '选择页缺少分页加载更多')
expect(receivable.includes('onPullDownRefresh') && payable.includes('onPullDownRefresh'), '选择页缺少下拉刷新')

for (const file of ['src/domains/finance/receivable-picker.ts', 'src/domains/finance/payable-picker.ts']) {
  expect(exists(file), `缺少一次性结果总线：${file}`)
  if (exists(file)) {
    const source = read(file)
    expect(source.includes('uni.removeStorageSync'), `${file} 未读取即消费`)
  }
}

if (failures.length) {
  console.error('财务登记选择器契约校验失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('财务登记选择器契约校验通过：独立页、一次性结果、空态与分页入口已冻结。')
