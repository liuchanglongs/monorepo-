// Worker池管理
class WorkerPool {
  constructor(size) {
    this.size = size
    this.workers = []
    this.taskQueue = []
    this.fileWorkerMap = new Map() // 记录每个文件分配的worker数量

    // 初始化worker池
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./utils/worker.ts', import.meta.url), { type: 'module' })
      this.workers.push({
        worker,
        isBusy: false,
        fileId: null,
      })
    }
  }

  // 分配worker给文件
  assignWorker(fileId, priority = 1) {
    // 查找空闲worker
    const idleWorker = this.workers.find(w => !w.isBusy)
    if (idleWorker) {
      idleWorker.isBusy = true
      idleWorker.fileId = fileId

      // 更新文件的worker计数
      if (!this.fileWorkerMap.has(fileId)) {
        this.fileWorkerMap.set(fileId, 0)
      }
      this.fileWorkerMap.set(fileId, this.fileWorkerMap.get(fileId) + 1)

      return idleWorker.worker
    }

    // 没有空闲worker，加入任务队列
    this.taskQueue.push({ fileId, priority })
    return null
  }

  // 释放worker
  releaseWorker(worker) {
    const workerInfo = this.workers.find(w => w.worker === worker)
    if (workerInfo) {
      const fileId = workerInfo.fileId
      workerInfo.isBusy = false
      workerInfo.fileId = null

      // 更新文件的worker计数
      if (fileId && this.fileWorkerMap.has(fileId)) {
        this.fileWorkerMap.set(fileId, Math.max(0, this.fileWorkerMap.get(fileId) - 1))
      }

      // 处理队列中的下一个任务
      this.processNextTask()
    }
  }

  // 处理队列中的下一个任务
  processNextTask() {
    if (this.taskQueue.length === 0) return

    // 按优先级排序
    this.taskQueue.sort((a, b) => b.priority - a.priority)

    // 获取下一个任务
    const nextTask = this.taskQueue.shift()
    const worker = this.assignWorker(nextTask.fileId, nextTask.priority)

    return worker
  }

  // 动态调整worker分配
  balanceWorkers(files) {
    // 根据文件大小、进度等因素计算每个文件的优先级
    const filePriorities = files.map(file => {
      const progress = file.uploadedTotal / file.totalChunks
      const size = file.file.size
      // 优先级计算：小文件优先，接近完成的文件优先
      const priority = (1 - progress) * 0.7 + (1 / size) * 0.3
      return { fileId: file.id, priority }
    })

    // 重新分配worker
    // 这里可以实现更复杂的分配逻辑
  }
}

// 请求队列管理
class UploadQueue {
  constructor(concurrency = 4) {
    this.concurrency = concurrency // 全局并发数
    this.running = 0 // 当前运行的请求数
    this.queue = []
    this.fileUploadMap = new Map() // 每个文件当前的上传请求数
  }

  // 添加上传任务
  enqueue(task, fileId) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task, // 上传函数
        fileId,
        resolve,
        reject,
      })
      this.processQueue()
    })
  }

  // 处理队列
  processQueue() {
    if (this.running >= this.concurrency) return

    // 按文件分组，确保每个文件都有机会上传
    const fileGroups = {}
    this.queue.forEach(item => {
      if (!fileGroups[item.fileId]) fileGroups[item.fileId] = []
      fileGroups[item.fileId].push(item)
    })

    // 轮询分配上传机会
    const fileIds = Object.keys(fileGroups)
    if (fileIds.length === 0) return

    // 找出上传量最少的文件优先处理
    let targetFileId = fileIds[0]
    let minUploads = this.fileUploadMap.get(targetFileId) || 0

    for (const fileId of fileIds) {
      const currentUploads = this.fileUploadMap.get(fileId) || 0
      if (currentUploads < minUploads) {
        minUploads = currentUploads
        targetFileId = fileId
      }
    }

    // 从目标文件中取出一个任务执行
    const taskIndex = this.queue.findIndex(item => item.fileId === targetFileId)
    if (taskIndex === -1) return

    const { task, fileId, resolve, reject } = this.queue.splice(taskIndex, 1)[0]

    // 更新计数
    this.running++
    this.fileUploadMap.set(fileId, (this.fileUploadMap.get(fileId) || 0) + 1)

    // 执行任务
    Promise.resolve(task())
      .then(result => {
        resolve(result)
      })
      .catch(err => {
        reject(err)
      })
      .finally(() => {
        this.running--
        this.fileUploadMap.set(fileId, (this.fileUploadMap.get(fileId) || 0) - 1)
        this.processQueue()
      })
  }

  // 动态调整并发数
  adjustConcurrency(networkSpeed) {
    // 根据网络速度动态调整并发数
    if (networkSpeed > 10000000) {
      // 10Mbps以上
      this.concurrency = 8
    } else if (networkSpeed > 5000000) {
      // 5Mbps以上
      this.concurrency = 6
    } else if (networkSpeed > 2000000) {
      // 2Mbps以上
      this.concurrency = 4
    } else {
      this.concurrency = 2
    }
  }
}
