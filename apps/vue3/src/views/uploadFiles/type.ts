export type fileIdType = string

export interface comChunkType {
  // 开始的size
  chunkStart: number
  // 结束的size
  chunkEnd: number
  // 第几个切片
  chunkIndex: number
}

export interface chunkType extends comChunkType {
  chunkHash: string
  //   后续优化：不要
  // chunkBlob?: Blob
  uploaded: boolean // 是否上传过
  // fileId: fileIdType
  // name?: string
  // size?: string
}

export interface taskChunkType extends comChunkType {
  //   后续优化：不要
  chunkBlob?: Blob
}

export interface fileInfoType {
  id: fileIdType
  file: File
  // pending:准备状态；uploading：上传状态
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
  progress: number
  seed: number
  //   切片完成的数据
  chunks: chunkType[]
  // 总切片数
  totalChunks: number
}

export interface workersType {
  worker: Worker
  isBusy: Boolean
  //  当前处理的文件列表
  handleFile?: string[]
}

// export interface uploadListType {
//   files: fileInfoType[]
//   // 开启的线程
//   workers: Worker[]
//   // 文件切片队列
//   fileTaskQueue: fileId[]
// }
