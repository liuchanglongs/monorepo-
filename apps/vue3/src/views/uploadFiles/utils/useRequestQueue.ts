// useRequestQueue.ts
import { ref, type Ref } from 'vue'
import { computed } from 'vue'
import type { chunkType, fileInfoType, workersType } from '../type'

export interface uploadChunkProps {
  chunk: chunkType
  file: File
  upLoadedChunks: any[]
  totalChunks: number
  CHUNK_SIZE: number
}

/**
 * @param uploadCunkPool 上传切片任务池
 * @param maxConcurrent 最大并发数
 * */
export function useRequestQueue(
  uploadCunkPool: Ref<{ [id: string]: chunkType[] }>,
  fileList: Ref<fileInfoType[]>,
  uploadChunk: (fileId: string, controller: AbortController) => Promise<any>,
  continueUpload: () => Promise<any>,
  maxConcurrent = 3
) {
  // 正在上传的文件请求数量的分配
  const activeConfig = ref<{ [key: string]: { total: number; pending: number } }>({})
  // 当前正在执行的请求数量
  const activeCountInfo = computed(() => {
    const comfig = activeConfig.value
    const keys = Object.keys(comfig)
    let activeCount = 0
    let all = 0
    if (keys.length === 0) return { activeCount, all }

    keys.forEach(key => {
      const { pending, total } = comfig[key]
      activeCount = activeCount + pending
      all = all + total
    })
    /**
     * activeCount: 当前正在执行的请求数量
     * all: 当前分配的总请求数量
     * */
    return { activeCount, all }
  })

  // 存储所有控制器，用于批量取消
  const allControllers = ref<{ fileId: string; controller: AbortController }[]>([])

  /**
   * 分配给文件的最大并发数
   * @param fileId 文件id
   * 分配原则：
   * 1. 每个文件至少分配一个请求
   * 2. 剩余请求：如果当前活跃请求数小于最大并发数，则为最大的文件分配一个请求
   * 3. 文件合并完成后，，分配给其它文件
   * */
  const assignFileRequest = (fileId?: string) => {
    const { activeCount, all } = activeCountInfo.value
    if (fileId) {
      activeConfig.value[fileId] = { total: 1, pending: 0 }
    } else {
      // 分配剩余请求
      // 剩余请求数
      const number = maxConcurrent - all
      if (activeCount < maxConcurrent && number > 0) {
        const pendingFile = fileList.value.filter(v => v.status === 'uploading')
        const sortData = pendingFile.sort((a, b) => b.file.size - a.file.size)
        if (sortData.length) {
          const { id: fileId } = sortData[0]
          if (!activeConfig.value[fileId]) {
            console.log(activeConfig.value[fileId])
            console.log(fileId, sortData)
            debugger
            return
          }
          const num = activeConfig.value[fileId].total || 0
          activeConfig.value[fileId].total = num + number
        }
      }
    }
    console.log('activeConfig-->', activeConfig.value)
  }

  /**
   * 1. hash计算完就，调用 processQueue()
   * 2. processQueue() 会根据 activeConfig 和 uploadCunkPool 来决定上传多少个切片
   * 3. 每次上传完成后，更新 activeConfig.pending，并再次调用 processQueue() 继续上传
   * 4.  直到 每个的 uploadCunkPool 为空且 activeConfig.pending 为0，表示这个文件上传完成
   * 5.  processQueue() 会继续为其它文件分配请求，直到所有文件上传完成。所有的pending 都为0，uploadCunkPool的key为空 结束调用
   * 为啥每次要执行activeConfig所有活跃的请求？
   *  hash未计算完：一个hash计算完->processQueue调用->发起请求,请求完成->processQueue调用
   *  hash计算完：最后一个hash计算完->processQueue调用->发起请求,请求完成->processQueue调用->发起请求,请求完成->processQueue调用
   *  假如这里可以同时请求3个，hash计算完后，假如有两个请求差不多同时计算完，A先获取了所有的剩余请求2个，同时要发起两个。activeConfig刚好计算
   * 完，B请求才计算requestNumber，最后!queueRequest.length为true，循环结束。那么这个时候A就要同时发起请求，这样的可能性很小
   * */

  const processQueue = async (workerindex: number) => {
    const fileIds = Object.keys(activeConfig.value)
    if (activeCountInfo.value.activeCount >= maxConcurrent) {
      console.log('请求已经满额，等待中...')
      return
    }

    if (activeCountInfo.value.activeCount === 0 && Object.keys(uploadCunkPool.value).length === 0) {
      console.log('所有文件全部上传完成')
      return
    }
    const queueRequest = []

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i]
      const { pending, total } = activeConfig.value[fileId]
      const queue = uploadCunkPool.value[fileId]
      const queueLength = queue?.length || 0
      const curPending = total - pending
      const requestNumber = queueLength > curPending ? curPending : queueLength
      // console.log('------------start')
      // console.log(fileId, requestNumber)
      if (requestNumber <= 0) {
        console.log('不发起请求，不能作为当前文件结束，请求速度大于切片hash计算速度，也可能为0')
        continue
      }
      for (let index = 0; index < requestNumber; index++) {
        const controller = new AbortController()
        queueRequest.push(() => uploadChunk(fileId, controller))
      }
      activeConfig.value[fileId].pending = activeConfig.value[fileId].pending + requestNumber
    }
    if (!queueRequest.length) {
      console.log(fileIds, '当前无请求', activeConfig.value)
      return
    }
    /**
     * 同时请求所有的该发的请求
     * */
    const result: { fileId: string; done: Boolean }[] = await Promise.all(
      queueRequest.map(fn => fn())
    )
    // console.log('uploadCunkPool', uploadCunkPool.value)
    // console.log('activeConfig', activeConfig.value)
    // console.log('result', result)
    // console.log('workerindex:', workerindex)
    // console.log('queueLength', queueRequest.length)
    // console.log('file', fileList.value)
    // console.log('end-----------------')
    // debugger
    for (let index = 0; index < result.length; index++) {
      const { fileId, done } = result[index]
      // 更新当前文件的活跃请求数
      activeConfig.value[fileId].pending = activeConfig.value[fileId].pending - 1
      const { totalChunks, uploadedTotal } = fileList.value.find(v => v.id === fileId)!
      // 合并成功后
      if (totalChunks === uploadedTotal) {
        if (uploadCunkPool.value[fileId].length === 0) delete uploadCunkPool.value[fileId]
        if (activeConfig.value[fileId]?.pending === 0) delete activeConfig.value[fileId]
        continueUpload()
      }
    }

    // // 继续调用
    await processQueue(workerindex)
  }

  // 清空队列
  const clearQueue = () => {
    // queue.value = []
    // status.value = 0
    // isSuspend.value = false
    // activeCount.value = 0
    // allControllers.value = []
  }

  /**
   * 清空队列并取消所有请求（包括正在执行的）
   */
  // const cancleRequest = () => {
  //   // 取消所有请求（包括正在执行的）
  //   allControllers.value.forEach(v => {
  //     const { controller, queueItem } = v
  //     controller.abort()
  //     // 从新添加到队列里面, 不清空queue，点击继续就不用重新计算hash
  //     queue.value.push({ ...queueItem })
  //   })
  //   allControllers.value = []
  //   activeCount.value = 0
  // }

  return {
    assignFileRequest,
    clearQueue,
    // activeCount,
    // queueLength: queue.value.length,
    // isSuspend,
    status,
    // cancleRequest,
    processQueue,
    activeConfig,
  }
}

export const useFileUploadProgress = () => {
  // 上传进度百分比 (0-100)
  const percent = ref(0)
  // 总块数
  const totalChunks = ref(0)
  // 已上传块数
  const uploadedChunks = ref(0)
  // 上传状态：idle, uploading, success, error
  const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
  // 错误信息
  const errorMessage = ref('')

  // 计算当前上传速度的辅助变量
  const startTime = ref<number | null>(null)
  const uploadedBytes = ref(0)
  const totalBytes = ref(0)
  const uploadSpeed = ref(0) // B/s

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // 已上传大小
  const uploadedSize = computed(() => formatFileSize(uploadedBytes.value))

  // 总大小
  const totalSize = computed(() => formatFileSize(totalBytes.value))
  const seed = computed(() => formatFileSize(uploadSpeed.value))

  // 重置上传状态
  const reset = () => {
    percent.value = 0
    totalChunks.value = 0
    uploadedChunks.value = 0
    uploadStatus.value = 'idle'
    errorMessage.value = ''
    startTime.value = null
    startTime.value = null
    uploadedBytes.value = 0
    totalBytes.value = 0
    uploadSpeed.value = 0
  }

  // 更新上传进度
  const updateProgress = (loaded: number, total: number, currentLoaded: number) => {
    // 初始化开始时间
    // if (!startTime.value) {
    //   totalBytes.value = total
    //   uploadStatus.value = 'uploading'
    // }

    uploadedBytes.value = loaded
    totalBytes.value = total

    // 计算百分比
    const getPercent = Number((Math.round((loaded / total) * 10000) / 100).toFixed(2))
    percent.value = getPercent > 99.98 ? 99.98 : getPercent

    if (startTime.value) {
      const end = Date.now()
      const elapsedTime = (end - startTime.value) / 1000 // 秒
      if (elapsedTime > 0) {
        uploadSpeed.value = Math.round(currentLoaded / elapsedTime)
      }
      startTime.value = end
    }
  }

  // 更新分块上传进度
  const updateChunkProgress = (chunkIndex: number, total: number, name?: string) => {
    if (totalChunks.value !== total) {
      totalChunks.value = total
      if (uploadStatus.value !== 'uploading') {
        uploadStatus.value = 'uploading'
      }
    }

    // 只更新新上传的块
    if (chunkIndex >= uploadedChunks.value) {
      uploadedChunks.value = chunkIndex + 1
    }

    // 计算百分比
    percent.value = Math.round((uploadedChunks.value / totalChunks.value) * 100)
  }

  // 标记上传成功
  const markAsSuccess = () => {
    uploadStatus.value = 'success'
    percent.value = 100
  }

  // 标记上传失败
  const markAsError = (message: string) => {
    uploadStatus.value = 'error'
    errorMessage.value = message
  }
  // 初始化开始时间
  const initStartTime = () => {
    if (!startTime.value) {
      startTime.value = Date.now()
    }
  }

  return {
    // 状态
    // percent,
    // uploadStatus,
    // errorMessage,
    // seed,
    // totalChunks,
    // uploadedChunks,
    // uploadSpeed,
    // uploadedSize,
    // totalSize,
    // initStartTime,
    // // 方法
    // reset,
    // updateProgress,
    // updateChunkProgress,
    // markAsSuccess,
    // markAsError,
  }
}
