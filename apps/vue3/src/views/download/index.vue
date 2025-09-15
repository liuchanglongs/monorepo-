<template>
  <div class="download-manager">
    <a href="http://localhost:3023/file/download/4.mp4" download="">下载</a>
    <div class="download-item" v-for="download in downloads" :key="download.id">
      <div class="file-info">
        <h4>{{ download.filename }}</h4>
        <span class="file-size">{{ formatFileSize(download.totalSize) }}</span>
      </div>

      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: download.progress + '%' }"></div>
        </div>
        <span class="progress-text">{{ download.progress.toFixed(1) }}%</span>
      </div>

      <div class="download-info">
        <span class="speed">{{ formatSpeed(download.speed) }}</span>
        <span class="downloaded"
          >{{ formatFileSize(download.downloadedSize) }} /
          {{ formatFileSize(download.totalSize) }}</span
        >
      </div>

      <div class="controls">
        <button
          @click="toggleDownload(download)"
          :class="{
            'btn-pause': download.status === 'downloading',
            'btn-resume': download.status === 'paused',
            'btn-start': download.status === 'pending',
          }"
        >
          {{ getButtonText(download.status) }}
        </button>
        <button @click="cancelDownload(download)" class="btn-cancel">取消</button>
      </div>

      <div class="status" :class="download.status">
        {{ getStatusText(download.status) }}
      </div>
    </div>

    <div class="add-download">
      <input
        v-model="newDownloadUrl"
        placeholder="输入文件名（如：4.mp4）"
        @keyup.enter="addDownload"
      />
      <button @click="addDownload">添加下载</button>
    </div>
  </div>
</template>

<script setup>
  import { ref, reactive, onUnmounted } from 'vue'
  // 引入StreamSaver
  import streamSaver from 'streamsaver'
  const downloads = ref([])
  const newDownloadUrl = ref('4.mp4')
  let downloadId = 0

  class DownloadManager {
    constructor(download) {
      this.download = download
      this.controller = null
      this.reader = null
      this.startTime = 0
      this.lastProgressTime = 0
      this.lastDownloadedSize = 0
    }

    async start() {
      try {
        this.download.status = 'downloading'
        this.controller = new AbortController()

        // 获取文件信息
        const fileInfo = await this.getFileInfo()
        this.download.totalSize = fileInfo.size
        console.log('fileInfo.size', formatFileSize(fileInfo.size))

        // 构建Range请求头
        const headers = {}
        if (this.download.downloadedSize > 0) {
          headers['Range'] = `bytes=${this.download.downloadedSize}-`
        }

        // 发起下载请求
        const response = await fetch(
          `http://localhost:3023/file/download-with-progress/${this.download.filename}`,
          {
            headers,
            signal: this.controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // 获取响应流 --- 务器不是一次性发送整个文件，而是分块发送：
        this.reader = response.body.getReader() // 获取可读流的读取器
        this.startTime = Date.now()
        this.lastProgressTime = this.startTime
        this.lastDownloadedSize = this.download.downloadedSize

        // 读取流数据
        await this.readStream()
      } catch (error) {
        if (error.name === 'AbortError') {
          this.download.status = 'paused'
        } else {
          console.error('Download error:', error)
          this.download.status = 'error'
          this.download.error = error.message
        }
      }
    }

    async readStream() {
      const chunks = []

      while (true) {
        // ### 浏览器端接收机制
        // 浏览器的 ReadableStream 会：

        // 1. 1.
        //    建立连接 ：与服务器建立 HTTP 连接
        // 2. 2.
        //    缓冲数据 ：将接收到的数据存储在内部缓冲区
        // 3. 3.
        //    分块读取 ： read() 方法从缓冲区中取出数据块
        // 4. 4.
        //  异步等待 ：如果缓冲区为空， read() 会等待新数据到达

        const { done, value } = await this. .read() // 每次读取一个数据块
        // //  value 大小 影响因素：
        // 1. 网络传输的分包大小
        // 2. 服务器的发送缓冲区大小
        // 3. 浏览器的接收缓冲区状态
        // 4. TCP 窗口大小和网络拥塞控制
        if (done) {
          this.download.status = 'completed'
          this.download.progress = 100

          // 下载完成，触发文件保存
          const blob = new Blob(chunks)
          this.saveFile(blob)
          break
        }

        // 更新下载进度
        chunks.push(value)
        this.download.downloadedSize += value.length
        this.updateProgress()
      }
    }

    updateProgress() {
      const now = Date.now()

      // 计算进度百分比
      this.download.progress = (this.download.downloadedSize / this.download.totalSize) * 100

      // 计算下载速度（每秒更新一次）
      if (now - this.lastProgressTime >= 1000) {
        const timeDiff = (now - this.lastProgressTime) / 1000
        const sizeDiff = this.download.downloadedSize - this.lastDownloadedSize
        this.download.speed = sizeDiff / timeDiff

        this.lastProgressTime = now
        this.lastDownloadedSize = this.download.downloadedSize
      }
    }

    async getFileInfo() {
      const response = await fetch(`http://localhost:3023/file/file-info/${this.download.filename}`)
      if (!response.ok) {
        throw new Error('获取文件信息失败')
      }
      return await response.json()
    }

    saveFile(blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = this.download.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    pause() {
      if (this.controller) {
        this.controller.abort()
      }
      this.download.status = 'paused'
    }

    cancel() {
      if (this.controller) {
        this.controller.abort()
      }
      this.download.status = 'cancelled'
      this.download.downloadedSize = 0
      this.download.progress = 0
    }
  }

  const downloadManagers = new Map()

  function addDownload() {
    if (!newDownloadUrl.value.trim()) return

    const download = reactive({
      id: ++downloadId,
      filename: newDownloadUrl.value.trim(),
      status: 'pending', // pending, downloading, paused, completed, error, cancelled
      progress: 0,
      downloadedSize: 0,
      totalSize: 0,
      speed: 0,
      error: null,
    })

    downloads.value.push(download)
    downloadManagers.set(download.id, new DownloadManager(download))
    newDownloadUrl.value = ''
  }

  function toggleDownload(download) {
    const manager = downloadManagers.get(download.id)

    if (download.status === 'downloading') {
      manager.pause()
    } else if (download.status === 'paused' || download.status === 'pending') {
      manager.start()
    }
  }

  function cancelDownload(download) {
    const manager = downloadManagers.get(download.id)
    manager.cancel()

    // 从列表中移除
    const index = downloads.value.findIndex(d => d.id === download.id)
    if (index > -1) {
      downloads.value.splice(index, 1)
    }
    downloadManagers.delete(download.id)
  }

  function getButtonText(status) {
    switch (status) {
      case 'downloading':
        return '暂停'
      case 'paused':
        return '继续'
      case 'pending':
        return '开始'
      case 'completed':
        return '完成'
      default:
        return '开始'
    }
  }

  function getStatusText(status) {
    switch (status) {
      case 'pending':
        return '等待中'
      case 'downloading':
        return '下载中'
      case 'paused':
        return '已暂停'
      case 'completed':
        return '已完成'
      case 'error':
        return '下载失败'
      case 'cancelled':
        return '已取消'
      default:
        return '未知状态'
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  function formatSpeed(bytesPerSecond) {
    return formatFileSize(bytesPerSecond) + '/s'
  }

  // 清理资源
  onUnmounted(() => {
    downloadManagers.forEach(manager => {
      if (manager.controller) {
        manager.controller.abort()
      }
    })
  })
</script>

<style scoped>
  .download-manager {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .download-item {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    background: #f9f9f9;
  }

  .file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .file-info h4 {
    margin: 0;
    color: #333;
  }

  .file-size {
    color: #666;
    font-size: 14px;
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4caf50, #45a049);
    transition: width 0.3s ease;
  }

  .progress-text {
    min-width: 50px;
    text-align: right;
    font-weight: bold;
    color: #333;
  }

  .download-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 14px;
    color: #666;
  }

  .controls {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .controls button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-pause {
    background: #ff9800;
    color: white;
  }

  .btn-resume,
  .btn-start {
    background: #4caf50;
    color: white;
  }

  .btn-cancel {
    background: #f44336;
    color: white;
  }

  .controls button:hover {
    opacity: 0.8;
  }

  .status {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
  }

  .status.downloading {
    color: #2196f3;
  }

  .status.paused {
    color: #ff9800;
  }

  .status.completed {
    color: #4caf50;
  }

  .status.error {
    color: #f44336;
  }

  .add-download {
    display: flex;
    gap: 8px;
    margin-top: 20px;
  }

  .add-download input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .add-download button {
    padding: 8px 16px;
    background: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .add-download button:hover {
    background: #1976d2;
  }
</style>
