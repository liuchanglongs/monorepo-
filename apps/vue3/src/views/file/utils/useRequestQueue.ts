// useRequestQueue.ts
import { ref } from 'vue'

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
  // 执行队列中的下一个请求
  const processQueue = async () => {
    // 如果达到最大并发数或队列为空，则停止处理
    if (activeCount.value >= maxConcurrent || queue.value.length === 0) {
      console.log('---------')

      return
    }
    // 从队列头部取出一个请求
    const { nextRequest } = queue.value.shift()!
    activeCount.value++
    try {
      // 请求过快，node 写入本地，导致电脑cpu会瞬间飙升
      tirm = setTimeout(async () => {
        // 执行请求并等待完成
        const isContinue = await nextRequest()
        if (isContinue) {
          activeCount.value--
          if (tirm) clearTimeout(tirm)
          // 完成后继续处理下一个请求（非递归调用，避免栈溢出）
          // console.log('queue.value:', queue.value)
          await processQueue()
        } else {
          // console.log('isContinue', isContinue)
        }
      }, 500)
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
