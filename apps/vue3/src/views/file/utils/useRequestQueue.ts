// useRequestQueue.ts
import { ref } from 'vue'
import { computed } from 'vue'
import type { chunkType } from './worker'

type RequestFunction<T> = (...args: any[]) => Promise<T>

export interface uploadChunkProps {
  chunk: chunkType
  file: File
  upLoadedChunks: any[]
  totalChunks: number
  CHUNK_SIZE: number
}

interface QueueItem {
  request: RequestFunction<boolean>
  data: uploadChunkProps
}

export function useRequestQueue(maxConcurrent = 3) {
  // 当前正在执行的请求数量
  const activeCount = ref(0)
  // 等待队列
  const queue = ref<QueueItem[]>([])
  // true 为暂停
  const isSuspend = ref(false)
  /**
   * 0:未开始上传；
   * 1：正在上传
   * 2：上传完成
   * 3：上传失败
   * */
  const status = ref<0 | 1 | 2 | 3>(0)
  // 存储所有控制器，用于批量取消
  const allControllers = ref<{ queueItem: QueueItem; controller: AbortController }[]>([])
  let tirm: any = null
  /**
   * 请求过快，node 写入本地，导致电脑cpu会瞬间飙升，这里做延时，
   * 可能导致每次只发出一个；
   * 原因是：800内请求完成，然后下一个，所以就是一个一个的发。
   * 后端解决不了只能这么做了
   * */
  const processQueue = async () => {
    // 执行队列中的下一个请求
    // 如果达到最大并发数或队列为空，则停止处理
    if (queue.value.length === 0) status.value = 2
    if (activeCount.value >= maxConcurrent || queue.value.length === 0 || isSuspend.value) {
      console.log('----------')
      return
    }

    if (tirm) clearTimeout(tirm)
    await new Promise(resolve => {
      tirm = setTimeout(async () => {
        resolve(true)
      }, 800)
    })
    // 从队列头部取出一个请求
    const queueItem = queue.value.shift()!
    const { data, request: nextRequest } = queueItem
    const hash = data.chunk.chunkHash!
    const controller = new AbortController()
    try {
      activeCount.value++
      allControllers.value.push({ controller, queueItem })
      // 执行请求并等待完成
      const isContinue = await nextRequest(data, controller)
      if (isContinue) {
        activeCount.value--
        // 完成后继续处理下一个请求（非递归调用，避免栈溢出）
        // console.log('queue.value:', queue.value)
        // 清除controller
        const oldAllControllers = [...allControllers.value]
        allControllers.value = oldAllControllers.filter(
          v => v.queueItem.data.chunk.chunkHash != hash
        )
        await processQueue()
      } else {
        console.log('isContinue', isContinue)
      }
    } catch (error) {
      // activeCount.value--
      console.log('请求执行失败:', error)
      // 可在这里添加错误处理逻辑，如重试、记录失败任务等
      // 例如：将失败任务重新加入队列尾部（需控制重试次数）
      // addRequest(nextRequest)
    }
  }

  // 添加请求到队列
  const addRequest = (item: QueueItem) => {
    if ((status.value! = 1)) status.value = 1
    // 将请求添加到队列
    queue.value.push({ ...item })
    // 尝试处理队列
    processQueue()
  }

  // 清空队列
  const clearQueue = () => {
    queue.value = []
    status.value = 0
    isSuspend.value = false
    activeCount.value = 0
    allControllers.value = []
  }

  /**
   * 清空队列并取消所有请求（包括正在执行的）
   */
  const cancleRequest = () => {
    // 取消所有请求（包括正在执行的）
    allControllers.value.forEach(v => {
      const { controller, queueItem } = v
      controller.abort()
      // 从新添加到队列里面, 不清空queue，点击继续就不用重新计算hash
      queue.value.push({ ...queueItem })
    })
    allControllers.value = []
    activeCount.value = 0
  }

  return {
    addRequest,
    clearQueue,
    activeCount,
    queueLength: queue.value.length,
    isSuspend,
    status,
    cancleRequest,
    processQueue,
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
    percent,
    uploadStatus,
    errorMessage,
    seed,
    totalChunks,
    uploadedChunks,
    uploadSpeed,
    uploadedSize,
    totalSize,
    initStartTime,
    // 方法
    reset,
    updateProgress,
    updateChunkProgress,
    markAsSuccess,
    markAsError,
  }
}
