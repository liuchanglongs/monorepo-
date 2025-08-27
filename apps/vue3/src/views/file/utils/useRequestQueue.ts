// useRequestQueue.ts
import { ref } from 'vue'
import { computed } from 'vue'

type RequestFunction<T> = (...args: any[]) => Promise<T>

interface QueueItem<T> {
  nextRequest: RequestFunction<T>
}

export function useRequestQueue(maxConcurrent = 3) {
  // 当前正在执行的请求数量
  const activeCount = ref(0)
  // 等待队列
  const queue = ref<QueueItem<any>[]>([])

  let tirm: any = null
  /**
   * 请求过快，node 写入本地，导致电脑cpu会瞬间飙升，这里做延时，
   * 可能导致每次只发出一个；
   * 原因是：800内请求完成，然后下一个，所以就是一个一个的发。
   * 后端解决不了只能这么做了
   * */
  const processQueue = async () => {
    if (tirm) clearTimeout(tirm)
    await new Promise(resolve => {
      tirm = setTimeout(async () => {
        resolve(true)
      }, 800)
    })
    // 执行队列中的下一个请求
    // 如果达到最大并发数或队列为空，则停止处理
    if (activeCount.value >= maxConcurrent || queue.value.length === 0) {
      return
    }
    try {
      console.log('activeCount.value', activeCount.value)

      // 从队列头部取出一个请求
      const { nextRequest } = queue.value.shift()!
      activeCount.value++
      // 执行请求并等待完成
      const isContinue = await nextRequest()
      if (isContinue) {
        activeCount.value--
        // 完成后继续处理下一个请求（非递归调用，避免栈溢出）
        // console.log('queue.value:', queue.value)
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
  const addRequest = <T>(request: RequestFunction<T>, ...args: any[]) => {
    // 将请求添加到队列
    queue.value.push({ nextRequest: request })
    // 尝试处理队列
    processQueue()
  }

  // 清空队列
  const clearQueue = () => {
    queue.value = []
  }

  return {
    addRequest,
    clearQueue,
    activeCount,
    queueLength: queue.value.length,
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
    percent.value = getPercent > 100 ? 100 : getPercent

    if (startTime.value) {
      const end = Date.now()
      const elapsedTime = (end - startTime.value) / 1000 // 秒
      if (elapsedTime > 0) {
        console.log('elapsedTime:', elapsedTime)
        console.log('currentLoaded:', currentLoaded)

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
