// 历史坑：FIX-005 分包领域文件曾被主包直接引用，导致启动找不到模块。
// 供应链领域模型已上移到 src/domains/supply/model.ts。
export * from '@/domains/supply/model'
