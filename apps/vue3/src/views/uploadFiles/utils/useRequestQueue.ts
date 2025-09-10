// useRequestQueue.ts
import { ref, type Ref } from 'vue'
import { computed } from 'vue'
import type { chunkType, fileInfoType, updateFileSeedCallBack, uploadChunkType } from '../type'
import type { fileIdType } from '../type'

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
  uploadChunk: (props: uploadChunkType) => Promise<any>,
  continueUpload: () => Promise<any>,
  updateFileSeed: (requestTotal: number) => updateFileSeedCallBack,
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
  const allControllers = ref<{
    [fileId: string]: { chunk: chunkType; controller: AbortController }[]
  }>({})

  /**
   * 分配给文件的最大并发数：
   *
   * @param fileId 文件id
   * 分配原则：
   * 1. 剩余请求：如果当前活跃请求数小于最大并发数，则为最大的文件分配一个请求
   * 2. 文件合并完成后，分配给其它文件
   * */
  const assignFileRequest = (fileId?: string) => {
    const { activeCount, all } = activeCountInfo.value
    if (all >= maxConcurrent) {
      console.log('没有多余的请求了')
      return
    }
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
    // console.log('activeConfig-->', activeConfig.value)
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

  const processQueue = async () => {
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
        queueRequest.push(() => {
          return uploadChunk({
            fileId,
            controller,
            callBack: {
              updateFileSeedCallBack: updateFileSeed(activeConfig.value[fileId].total),
              collectController: (chunk: chunkType, isCompelete?: boolean) => {
                if (!isCompelete) {
                  // 开始调用接口
                  if (!allControllers.value[fileId]) {
                    allControllers.value[fileId] = []
                  }
                  allControllers.value[fileId].push({ chunk, controller })
                } else {
                  // 接口调用完成
                  allControllers.value[fileId] = allControllers.value[fileId].filter(
                    v => v.chunk.chunkHash != chunk.chunkHash
                  )
                }
              },
            },
          })
        })
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
    console.log('result', result)
    // console.log('workerindex:', workerindex)
    // console.log('queueLength', queueRequest.length)
    // console.log('file', fileList.value)
    // console.log('end-----------------')
    // debugger
    for (let index = 0; index < result.length; index++) {
      const { fileId, done } = result[index]
      if (!result[index] || !done) continue
      // 更新当前文件的活跃请求数
      activeConfig.value[fileId].pending = activeConfig.value[fileId].pending - 1
      handleStatusUploadingFile(fileId)
      const { totalChunks, uploadedTotal } = fileList.value.find(v => v.id === fileId)!
      // 合并成功后
      if (totalChunks === uploadedTotal) {
        if (uploadCunkPool.value[fileId].length === 0) delete uploadCunkPool.value[fileId]
        if (activeConfig.value[fileId]?.pending === 0) delete activeConfig.value[fileId]
        continueUpload()
      }
    }

    // // 继续调用
    await processQueue()
  }

  /**
   * 开始上传暂停的文件: 特殊情况：批量请求被全部被占用； 需要重新分配
   * */
  const handleStatusUploadingFile = (fileId: string) => {
    let targetFile = null
    fileList.value.forEach(v => {
      if (v.status == 'pending' && !v.bindworkerIndex.length) {
        targetFile = v
      }
    })
    console.log('targetFile', targetFile)
    if (targetFile) {
      const { id } = targetFile

      const max: any = { id: null, total: 0 }
      Object.keys(activeConfig).forEach((key: string) => {
        const { total } = activeConfig.value[key]
        if (total) {
          if (total > max.total) {
            max.id = key
            max.total = total
          }
        }
      })
      if (fileId === max.id && activeConfig.value[fileId]?.total > 1) {
        activeConfig.value[fileId].total = activeConfig.value[fileId].total - 1
        activeConfig.value[id] = { total: 1, pending: 0 }
      }
    }
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
   *  取消该任务的正在执行的所有请求
   */
  const cancleRequest = (fileId: string) => {
    const controllers = allControllers.value[fileId]
    if (controllers && Object.keys(controllers)?.length) {
      Object.keys(controllers).forEach((key: any) => {
        const { chunk, controller } = controllers[key]
        controller.abort()
        if (!uploadCunkPool.value[fileId]) uploadCunkPool.value[fileId] = []
        uploadCunkPool.value[fileId].push(chunk)
      })
    }
    cancelActiveConfig(fileId)
  }
  // 取消请求分配
  const cancelActiveConfig = (fileId: string) => {
    if (activeConfig.value[fileId]) {
      delete activeConfig.value[fileId]
    }
  }

  return {
    assignFileRequest,
    clearQueue,
    processQueue,
    activeConfig,
    cancleRequest,
  }
}

export const useUpdateFileUploadInfo = (fileList: Ref<fileInfoType[]>) => {
  // 计算当前上传速度的辅助变量
  const startTime = ref<{ [fileId: fileIdType]: number }>({})

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const updateFileProgress = (
    fileInfoIndex: number,
    currentUploadedTotal: number,
    totalChunks: number
  ) => {
    const getPercent = Number(
      (Math.round((currentUploadedTotal / totalChunks) * 10000) / 100).toFixed(2)
    )
    fileList.value[fileInfoIndex].progress = getPercent
  }

  const updateFileSeed = (requestTotal: number) => {
    const start = Date.now()
    let seed = 0
    return (fileId: fileIdType, CHUNK_SIZE: number, fileInfoIndex: number) => {
      const end = Date.now()
      const elapsedTime = (end - start) / 1000 // 秒
      if (elapsedTime > 0) {
        seed = Math.round((CHUNK_SIZE * requestTotal) / elapsedTime)
      }
      startTime.value[fileId] = end

      fileList.value[fileInfoIndex].seed = formatFileSize(seed)
    }
  }

  return {
    updateFileProgress,
    updateFileSeed,
  }
}

export const manageFileBindworkerIndex = (props: {
  fileList: Ref<fileInfoType[]>
  fileId: string
  workerIndex?: number
  type: 'add' | 'update' | 'delete'
}) => {
  const { fileList, fileId, workerIndex, type } = props

  if (type === 'add') {
    const fileIndex = fileList.value.findIndex(v => v.id === fileId)
    if (!fileList.value[fileIndex].bindworkerIndex.includes(workerIndex)) {
      fileList.value[fileIndex].bindworkerIndex.push(workerIndex)
    }
  } else if (type === 'update') {
  } else if (type === 'delete') {
    const fileIndex = fileList.value.findIndex(v => v.id === fileId)
    fileList.value[fileIndex].bindworkerIndex = []
  }
}
