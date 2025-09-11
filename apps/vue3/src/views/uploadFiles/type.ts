import type { Ref } from 'vue'

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
  uploaded: boolean // 是否上传过
}

export interface taskChunkType extends comChunkType {
  chunkBlob?: Blob
}

export interface fileInfoType {
  id: fileIdType
  file: File
  // pending:准备状态；uploading：上传状态
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
  progress: number
  seed: number | string
  // 是否绑定了worker: 方便寻找线程
  bindworkerIndex: any[]
  /**
   * 特殊情况：
   * once: 代表暂停后，点击开始上传，uploadNumber >  fileList.length(uploading)
   * */
  uniqueStatus?: 'once'
  // 已经上传切片的数量
  uploadedTotal: number
  // 总切片数
  totalChunks: number
}

export interface workersType {
  worker: Worker
  // 是否在工作
  isBusy: Boolean
  //  当前处理的文件列表：
  handleFile?: fileIdType
}

export type updateFileSeedCallBack = (
  fileId: string,
  CHUNK_SIZE: number,
  fileInfoIndex: number
) => any

export interface uploadChunkType {
  fileId: string
  controller: AbortController
  callBack: {
    updateFileSeedCallBack: updateFileSeedCallBack
    collectController: (chunk: chunkType, isCompelete?: boolean) => any
  }
}
