export type fileIdType = string | number

export interface chunkType {
  // 开始的size
  chunkStart?: number
  // 结束的size
  chunkEnd?: number
  // 第几个切片
  chunkIndex: number
  chunkHash?: string
  //   后续优化：不要
  chunkBlob?: Blob
  uploaded: boolean // 是否上传过
  fileId: fileIdType
  name?: string
  size?: string
}

export interface fileInfoType {
  id: fileIdType
  file: File
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
  progress: number
  seed: number
  //   切片完成的数据
  chunks: chunkType[]
  // 总切片数
  totalChunks: number
  // 当前处理的worker
  worker?: Worker
}

export interface workersType {
  worker: Worker
  isBusy: Boolean
}

// export interface uploadListType {
//   files: fileInfoType[]
//   // 开启的线程
//   workers: Worker[]
//   // 文件切片队列
//   fileTaskQueue: fileId[]
// }
