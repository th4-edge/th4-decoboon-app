export interface DocumentArchive {
  documentId: string
  type: string
  audience: string
  businessNo: string
  templateVersion: number
  path: string
  sha256: string
  fileName: string
  contentType: string
  size: number
  generatedAt?: string
  status: string
  url: string
  urlExpiresAt?: string
}
