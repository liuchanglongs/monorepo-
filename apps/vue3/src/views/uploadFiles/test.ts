class AdvancedFileDownloader {
  constructor(url, options = {}) {
    this.url = url
    this.chunkSize = options.chunkSize || 1024 * 1024 * 2
    this.maxConcurrent = options.maxConcurrent || 3
    this.retryCount = options.retryCount || 3

    // 状态管理
    this.status = 'idle'
    this.chunks = new Map() // chunkIndex -> { data, status, retryCount }
    this.downloadQueue = []
    this.activeDownloads = new Map()
    this.controllers = new Map()

    // 进度和统计
    this.downloadedBytes = 0
    this.startTime = null
    this.speeds = [] // 用于计算平均速度

    // 事件系统
    this.events = new EventTarget()

    // WebWorker for file processing
    this.worker = new Worker('/js/download-worker.js')
    this.setupWorker()
  }

  // 暂停下载
  pause() {
    if (this.status !== 'downloading') return

    this.status = 'paused'

    // 取消所有活跃的下载
    this.controllers.forEach(controller => {
      controller.abort()
    })

    this.controllers.clear()
    this.activeDownloads.clear()

    this.emit('paused')
  }

  // 恢复下载
  async resume() {
    if (this.status !== 'paused') return

    this.status = 'downloading'
    await this.processDownloadQueue()
    this.emit('resumed')
  }

  // 控制并发数量
  setMaxConcurrent(count) {
    this.maxConcurrent = Math.max(1, Math.min(count, 10))

    if (this.status === 'downloading') {
      // 如果当前下载数超过新的限制，暂停部分下载
      const activeCount = this.activeDownloads.size
      if (activeCount > this.maxConcurrent) {
        const toCancel = activeCount - this.maxConcurrent
        let cancelled = 0

        for (const [chunkIndex, controller] of this.controllers) {
          if (cancelled >= toCancel) break
          controller.abort()
          this.controllers.delete(chunkIndex)
          this.activeDownloads.delete(chunkIndex)
          cancelled++
        }
      }
    }
  }

  // 核心下载逻辑
  async processDownloadQueue() {
    while (
      this.downloadQueue.length > 0 &&
      this.activeDownloads.size < this.maxConcurrent &&
      this.status === 'downloading'
    ) {
      const chunkIndex = this.downloadQueue.shift()
      this.downloadChunkWithRetry(chunkIndex)
    }
  }

  async downloadChunkWithRetry(chunkIndex) {
    const chunk = this.chunks.get(chunkIndex)

    try {
      this.activeDownloads.set(chunkIndex, Date.now())
      const controller = new AbortController()
      this.controllers.set(chunkIndex, controller)

      const result = await this.downloadChunk(chunkIndex, controller.signal)

      // 成功下载
      chunk.data = result.data
      chunk.status = 'completed'
      this.downloadedBytes += result.data.byteLength

      this.updateSpeed(result.data.byteLength)
      this.emit('chunkCompleted', { chunkIndex, progress: this.getProgress() })
    } catch (error) {
      if (error.name === 'AbortError') {
        // 被取消，重新加入队列
        chunk.status = 'pending'
        this.downloadQueue.unshift(chunkIndex)
      } else {
        // 下载失败，重试
        chunk.retryCount = (chunk.retryCount || 0) + 1

        if (chunk.retryCount < this.retryCount) {
          chunk.status = 'pending'
          this.downloadQueue.push(chunkIndex) // 重试放到队列末尾
        } else {
          chunk.status = 'error'
          this.emit('chunkError', { chunkIndex, error })
        }
      }
    } finally {
      this.activeDownloads.delete(chunkIndex)
      this.controllers.delete(chunkIndex)

      // 继续处理队列
      if (this.status === 'downloading') {
        this.processDownloadQueue()
      }

      // 检查是否完成
      this.checkCompletion()
    }
  }

  // 检查下载完成
  checkCompletion() {
    const completedChunks = Array.from(this.chunks.values()).filter(
      chunk => chunk.status === 'completed'
    )

    if (completedChunks.length === this.totalChunks) {
      this.status = 'merging'
      this.mergeFile()
    }
  }

  // 使用 WebWorker 合并文件
  mergeFile() {
    const chunksData = Array.from(this.chunks.entries())
      .sort(([a], [b]) => a - b)
      .map(([index, chunk]) => ({ index, data: chunk.data }))

    this.worker.postMessage({
      type: 'merge',
      chunks: chunksData,
      totalSize: this.fileSize,
    })
  }

  setupWorker() {
    this.worker.onmessage = e => {
      const { type, data } = e.data

      if (type === 'merged') {
        this.status = 'completed'
        this.emit('completed', { file: data.mergedBuffer })
      }
    }
  }

  // 事件系统
  on(event, callback) {
    this.events.addEventListener(event, callback)
  }

  emit(event, data) {
    this.events.dispatchEvent(new CustomEvent(event, { detail: data }))
  }

  // 获取下载进度
  getProgress() {
    return {
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.fileSize,
      percentage: (this.downloadedBytes / this.fileSize) * 100,
      speed: this.getCurrentSpeed(),
      eta: this.getETA(),
    }
  }

  // 计算下载速度
  updateSpeed(bytes) {
    const now = Date.now()
    this.speeds.push({ bytes, time: now })

    // 只保留最近10秒的数据
    this.speeds = this.speeds.filter(s => now - s.time < 10000)
  }

  getCurrentSpeed() {
    if (this.speeds.length < 2) return 0

    const totalBytes = this.speeds.reduce((sum, s) => sum + s.bytes, 0)
    const timeSpan = this.speeds[this.speeds.length - 1].time - this.speeds[0].time

    return timeSpan > 0 ? (totalBytes / timeSpan) * 1000 : 0 // bytes/second
  }

  getETA() {
    const speed = this.getCurrentSpeed()
    if (speed === 0) return Infinity

    const remainingBytes = this.fileSize - this.downloadedBytes
    return remainingBytes / speed // seconds
  }
}

// 创建下载器
const downloader = new AdvancedFileDownloader('https://example.com/largefile.zip', {
  chunkSize: 1024 * 1024 * 2, // 2MB per chunk
  maxConcurrent: 3,
  retryCount: 3,
})

// 监听事件
downloader.on('progress', e => {
  const { percentage, speed, eta } = e.detail
  console.log(
    `进度: ${percentage.toFixed(2)}%, 速度: ${formatSpeed(speed)}, 剩余时间: ${formatTime(eta)}`
  )
})

downloader.on('completed', e => {
  const { file } = e.detail
  // 创建下载链接
  const blob = new Blob([file])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'downloaded-file.zip'
  a.click()
})

// 开始下载
downloader.start()

// 控制下载
document.getElementById('pause').onclick = () => downloader.pause()
document.getElementById('resume').onclick = () => downloader.resume()
document.getElementById('speed-control').onchange = e => {
  downloader.setMaxConcurrent(parseInt(e.target.value))
}


// a连接下载，--->降级 文件api下载


// ### <a> 标签下载的局限性：
// 1. 1.
//    性能问题 - 大文件需要完全加载到内存中才能触发下载
// 2. 2.
//    路径限制 - 无法让用户选择保存路径，只能保存到默认下载目录
// 3. 3.
//    用户体验差 - 大文件下载时浏览器可能卡顿
// 4. 4.
//    内存占用高 - 文件越大，内存消耗越大
// ## 更好的解决方案



// 1. File System Access API (推荐)
// 让用户选择保存路径和文件名
async function saveFileWithDialog(data, suggestedName) {
  try {
    // 检查浏览器支持
    if ('showSaveFilePicker' in window) {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        types: [{
          description: 'All files',
          accept: {'*/*': []}
        }]
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      
      console.log('文件保存成功');
    } else {
      // 降级到传统方案
      fallbackDownload(data, suggestedName);
    }
  } catch (err) {
    console.log('用户取消了保存操作');
  }
}

// 2. 流式下载 (Stream API)
// 流式处理大文件，避免内存问题
async function streamDownload(url, filename) {
  try {
    const response = await fetch(url);
    const reader = response.body.getReader();
    
    // 使用 File System Access API
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: filename
    });
    
    const writable = await fileHandle.createWritable();
    
    // 流式写入
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      await writable.write(value);
    }
    
    await writable.close();
  } catch (error) {
    console.error('下载失败:', error);
  }
}

// 3. 带进度的分片下载
class AdvancedDownloader {
  constructor() {
    this.abortController = new AbortController();
  }
  
  async downloadWithProgress(url, filename, onProgress) {
    try {
      // 获取文件信息
      const headResponse = await fetch(url, { method: 'HEAD' });
      const totalSize = parseInt(headResponse.headers.get('content-length'));
      
      // 用户选择保存位置
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename
      });
      
      const writable = await fileHandle.createWritable();
      let downloadedSize = 0;
      
      // 分片下载
      const chunkSize = 1024 * 1024; // 1MB per chunk
      
      for (let start = 0; start < totalSize; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, totalSize - 1);
        
        const response = await fetch(url, {
          headers: {
            'Range': `bytes=${start}-${end}`
          },
          signal: this.abortController.signal
        });
        
        const chunk = await response.arrayBuffer();
        await writable.write(chunk);
        
        downloadedSize += chunk.byteLength;
        
        // 更新进度
        if (onProgress) {
          onProgress({
            loaded: downloadedSize,
            total: totalSize,
            percentage: (downloadedSize / totalSize) * 100
          });
        }
      }
      
      await writable.close();
      return { success: true };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('下载被取消');
      } else {
        console.error('下载失败:', error);
      }
      return { success: false, error };
    }
  }
  
  // 暂停/取消下载
  cancel() {
    this.abortController.abort();
  }
}

// 4. 实际使用示例
// 在你的 Vue 组件中使用
const downloadFile = async (fileUrl, fileName) => {
  // 检查浏览器支持
  if (!('showSaveFilePicker' in window)) {
    ElMessage.warning('当前浏览器不支持文件保存对话框，将使用默认下载方式');
    // 降级到 a 标签下载
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
    return;
  }
  
  const downloader = new AdvancedDownloader();
  
  try {
    await downloader.downloadWithProgress(fileUrl, fileName, (progress) => {
      console.log(`下载进度: ${progress.percentage.toFixed(2)}%`);
      // 更新 UI 进度条
    });
    
    ElMessage.success('文件下载完成');
  } catch (error) {
    ElMessage.error('下载失败: ' + error.message);
  }
};

// ## 浏览器兼容性
- File System Access API : Chrome 86+, Edge 86+ (需要 HTTPS)
- Stream API : 大部分现代浏览器支持
- 降级方案 : 不支持时自动回退到传统 <a> 标签下载