import { createPickerChannel, type PickerResult } from '@/domains/common/picker'
import type { Worker } from './model'

export const WORKER_PICKER_KEY = 'labor_worker_picker_result'
export type WorkerPickerResult = PickerResult<Worker>

function isWorker(value: unknown): value is Worker {
  if (!value || typeof value !== 'object') return false
  const worker = value as Partial<Worker>
  return Boolean(worker.id && worker.name && worker.status)
}

const channel = createPickerChannel<Worker>(WORKER_PICKER_KEY, isWorker)

export function setWorkerPickerResult(result: WorkerPickerResult) {
  channel.set(result)
}

export function consumeWorkerPickerResult(): WorkerPickerResult | null {
  return channel.consume()
}
