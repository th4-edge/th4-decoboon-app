/** 与 th4 Provider 的 Page<Entity> 对齐。 */
export interface PageResult<T> {
  total: number
  size: number
  current: number
  records: T[]
  /** Spring Data Page 标准响应字段。 */
  content?: T[]
  totalElements?: number
  totalPages?: number
  number?: number
}

/** 兼容 Provider 直接返回数组或 Page 的场景。 */
export function pageRecords<T>(result: PageResult<T> | T[] | null | undefined): T[] {
  if (!result) return []
  if (Array.isArray(result)) return result
  return result.records || result.content || []
}

export interface PageData<T> {
  list: T[]
  total: number
  hasMore: boolean
}

export function toPageData<T>(
  result: PageResult<T> | T[] | null | undefined,
  current: number,
  size: number
): PageData<T> {
  const list = pageRecords(result)
  const total = Array.isArray(result)
    ? list.length
    : Number(result?.totalElements ?? result?.total ?? list.length)
  const hasMore = Array.isArray(result)
    ? list.length >= size
    : current * size < total
  return { list, total, hasMore }
}
