// 类型定义
export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled'

export interface SelectOption {
  label: string
  value: string
}

export interface Download {
  id: number
  filename: string
  status: DownloadStatus
  progress: number
  downloadedSize: number
  totalSize: number
  speed: number
  error: string | null
}

export interface FileInfo {
  size: number
  [key: string]: any
}

export interface ApiResponse<T = any> {
  data: T
  message?: string
  code?: number
}
