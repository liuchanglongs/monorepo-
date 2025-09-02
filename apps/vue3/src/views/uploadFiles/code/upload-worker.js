// 存储当前任务状态
let currentTask = null
let isPaused = false
let currentChunkIndex = 0

// 监听主线程消息
self.onmessage = function (e) {
  const { type, data } = e.data

  switch (type) {
    case 'init':
      // 初始化任务
      currentTask = {
        file: e.data.file,
        fileId: e.data.fileId,
        chunkSize: e.data.chunkSize,
        totalChunks: e.data.totalChunks,
      }
      isPaused = false
      currentChunkIndex = 0

      // 开始处理切片
      processNextChunk()
      break

    case 'pause':
      // 暂停任务
      isPaused = true
      currentTask = null
      break

    case 'chunkUploaded':
      // 切片上传完成，继续处理下一个
      if (!isPaused) {
        self.postMessage({
          type: 'uploadProgress',
          data: {
            chunkIndex: e.data.chunkIndex,
          },
        })
        processNextChunk()
      }
      break
  }
}

// 处理下一个切片
function processNextChunk() {
  if (isPaused) return

  // 所有切片处理完成
  if (currentChunkIndex >= currentTask.totalChunks) {
    self.postMessage({
      type: 'completed',
      data: {
        fileId: currentTask.fileId,
      },
    })
    return
  }

  // 计算当前切片的起始和结束位置
  const start = currentChunkIndex * currentTask.chunkSize
  const end = Math.min(start + currentTask.chunkSize, currentTask.file.size)
  const chunk = currentTask.file.slice(start, end)

  // 计算切片哈希（模拟，实际项目中可使用spark-md5等库）
  calculateHash(chunk).then(hash => {
    if (!isPaused) {
      // 通知主线程切片处理完成，准备上传
      self.postMessage({
        type: 'chunkProcessed',
        data: {
          fileId: currentTask.fileId,
          chunkIndex: currentChunkIndex,
          chunk: chunk,
          hash: hash,
        },
      })

      // 准备处理下一个切片
      currentChunkIndex++
    }
  })
}

// 计算切片哈希（模拟）
function calculateHash(chunk) {
  return new Promise(resolve => {
    // 实际项目中应使用FileReader读取chunk并计算哈希
    // 这里简化处理，用时间戳+随机数模拟哈希
    setTimeout(() => {
      const hash = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      resolve(hash)
    }, 50) // 模拟计算耗时
  })
}
