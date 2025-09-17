<template>
  <div class="download-manager">
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
        <button
          v-if="download.status != 'completed'"
          @click="cancelDownload(download)"
          class="btn-cancel"
        >
          取消
        </button>
      </div>

      <div class="status" :class="download.status">
        {{ getStatusText(download.status) }}
      </div>
    </div>

    <div class="add-download">
      <el-select v-model="selectData" placeholder="Select" style="width: 440px" multiple>
        <el-option
          v-for="item in selectDataOptios"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <button @click="addDownload">添加下载(同时下载{{ downloadNUmber }}个)</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onUnmounted, onMounted, type Ref } from 'vue'
  import type { SelectOption, DownloadStatus, Download, ApiResponse, FileInfo } from './type'

  // 响应式数据
  const selectData: Ref<string[]> = ref([])
  const selectDataOptios: Ref<SelectOption[]> = ref([])

  const downloadNUmber: Ref<number> = ref(3)

  const downloads: Ref<Download[]> = ref([])
  const downloadManagers = new Map<number, DownloadManager>()

  // 选择保存目录
  const dirHandle = ref<any>(null)

  onMounted(async (): Promise<void> => {
    try {
      // 发起下载请求
      const response = await fetch(`http://localhost:3023/file/list`)
      const result: ApiResponse<SelectOption[]> = await response.json()
      selectDataOptios.value = result.data
    } catch (error) {
      console.error('获取文件列表失败:', error)
    }
  })

  // 清理资源
  onUnmounted((): void => {
    downloadManagers.forEach((manager: DownloadManager) => {
      if (manager.controller) {
        manager.controller.abort()
      }
    })
  })

  class DownloadManager {
    download: Download
    controller: AbortController | null
    reader: ReadableStreamDefaultReader<Uint8Array> | null
    startTime: number
    lastProgressTime: number
    lastDownloadedSize: number
    fileHandle: any
    writable: any

    constructor(download: Download) {
      this.download = download
      this.controller = null
      this.reader = null
      this.startTime = 0
      this.lastProgressTime = 0
      this.lastDownloadedSize = 0
      this.fileHandle = null
      this.writable = null
    }

    async start(): Promise<void> {
      try {
        const status = this.download.status
        const downloadUrl = `http://localhost:3023/file/download/${this.download.filename}`
        this.controller = new AbortController()
        // 获取文件信息
        const fileInfo: FileInfo = await this.getFileInfo()
        this.download.status = 'downloading'

        this.download.totalSize = fileInfo.size
        if (!dirHandle.value) {
          dirHandle.value = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'downloads',
          })
        }

        // 创建文件句柄
        this.fileHandle = await dirHandle.value.getFileHandle(this.download.filename, {
          create: true,
        })
        // 创建可写流
        this.writable = await this.fileHandle.createWritable()

        // 发起下载请求
        const response = await fetch(downloadUrl, {
          signal: this.controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // 获取响应流 --- 不是一次性发送整个文件，而是分块发送：
        if (!response.body) {
          throw new Error('无法获取响应流')
        }
        // 方法1：
        this.reader = response.body.getReader() // 获取可读流的读取器

        this.startTime = Date.now()
        this.lastProgressTime = this.startTime
        this.lastDownloadedSize = this.download.downloadedSize

        // 读取流数据
        await this.readStream()

        // 方法2：
        // // 创建可写流
        // const writable = await this.fileHandle.createWritable()
      } catch (error: any) {
        if (error.name === 'AbortError') {
          this.download.status = 'paused'
        } else {
          console.error('Download error:', error)
          this.download.status = 'error'
          this.download.error = error.message
        }
      }
    }
    async resumeDownload() {
      try {
        // 创建新的中止控制器
        this.controller = new AbortController()
        const downloadUrl = `http://localhost:3023/file/download/${this.download.filename}`
        this.download.status = 'downloading'

        // 使用Range请求从断点继续
        const response = await fetch(downloadUrl, {
          headers: {
            Range: `bytes=${this.download.downloadedSize}-`,
          },
          signal: this.controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // 获取响应流 --- 不是一次性发送整个文件，而是分块发送：
        if (!response.body) {
          throw new Error('无法获取响应流')
        }

        // 方法1：
        this.reader = response.body.getReader() // 获取可读流的读取器
        // 关键修复：获取现有文件内容，然后重新创建包含现有数据的文件
        // const existingFile = await this.fileHandle.getFile()
        // const existingArrayBuffer = await existingFile.arrayBuffer()
        // if (existingArrayBuffer.byteLength != this.download.downloadedSize) {
        //   console.log(this.download.downloadedSize)
        //   console.log(existingArrayBuffer.byteLength)
        //   debugger
        // }
        // 重新创建可写流
        // writable = await fileHandle.createWritable({ keepExistingData: true })
        // 设置写入位置
        // await this.writable.write({ type: 'seek', position: existingArrayBuffer.byteLength })
        // 读取流数据
        await this.readStream()
      } catch (error: any) {
        console.log(error)
      }
    }

    private async readStream(): Promise<void> {
      if (!this.reader || !this.writable) return
      try {
        while (true) {
          // 检查是否暂停
          if (this.download.status === 'paused' || this.download.status === 'cancelled') {
            console.log('检测到暂停信号，停止读取')
            break
          }
          const { done, value } = await this.reader.read()
          if (done) {
            // 下载完成
            await this.writable.close()
            this.writable = null
            this.download.status = 'completed'
            this.download.progress = 100
            // 下载完成，触发文件保存
            // const blob = new Blob(chunks)
            // this.saveFile(blob)
            break
          }

          if (value) {
            // 写入数据到文件
            console.log('this.writable', this.writable)

            await this.writable.write(value)
            // 更新下载进度
            this.download.downloadedSize += value.length
            this.updateProgress()
          }
        }
      } catch (error) {
        console.log('write:', error)
      }
    }
    // private async pipeToStream () {
    //   // 5. 关键：创建进度监控转换流
    //   // let downloadedBytes = 0;
    //   const that = this
    //   const progressTransform = new TransformStream({
    //     transform(chunk, controller) {
    //       // 更新下载进度
    //       that.download.downloadedSize += chunk.byteLength
    //       that.updateProgress()
    //       // 累加已下载字节数
    //       // downloadedBytes += chunk.byteLength;
    //       // 计算进度百分比
    //       // const progress = Math.min(Math.round((downloadedBytes / contentLength) * 100), 100);

    //       // 更新UI（使用requestAnimationFrame确保渲染流畅）
    //       // requestAnimationFrame(() => {
    //       //   progressText.textContent = `${progress}%`;
    //       //   progressBar.style.width = `${progress}%`;
    //       //   status.textContent = `正在下载: ${formatFileSize(downloadedBytes)} / ${formatFileSize(contentLength)}`;
    //       // });

    //       // 将数据传递给下一个流（不修改原始数据）
    //       controller.enqueue(chunk)
    //     },
    //   })
    //   const res = await response.body
    //     .pipeThrough(progressTransform) // 先经过进度监控流
    //     .pipeTo(writable) // 获取可读流的读取器
    //   this.writable = null
    //   this.download.status = 'completed'
    //   this.download.progress = 100
    // }
    private updateProgress(): void {
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

    private async getFileInfo(): Promise<FileInfo> {
      const response = await fetch(`http://localhost:3023/file/file-info/${this.download.filename}`)
      if (!response.ok) {
        throw new Error('获取文件信息失败')
      }
      return await response.json()
    }

    pause(): void {
      if (this.controller) {
        this.controller.abort()
      }
      this.download.status = 'paused'
    }

    cancel(): void {
      if (this.controller) {
        this.controller.abort()
      }
      this.download.status = 'cancelled'

      this.download.downloadedSize = 0
      this.download.progress = 0
    }
  }

  const addDownload = () => {
    selectData.value.forEach((filename, id) => {
      const download: Download = reactive({
        id,
        filename: filename,
        status: 'pending', // pending, downloading, paused, completed, error, cancelled
        progress: 0,
        downloadedSize: 0,
        totalSize: 0,
        speed: 0,
        error: null,
      })
      downloads.value.push(download)
      downloadManagers.set(download.id, new DownloadManager(download))
    })
    selectData.value = []
  }

  const toggleDownload = (download: Download) => {
    const manager = downloadManagers.get(download.id)
    if (!manager) return
    if (download.status === 'downloading') {
      manager.pause()
    } else if (download.status === 'paused') {
      manager.resumeDownload()
    } else if (download.status === 'pending') {
      manager.start()
    }
  }

  function cancelDownload(download: Download): void {
    const manager = downloadManagers.get(download.id)
    if (!manager) return

    manager.cancel()

    // 从列表中移除
    const index = downloads.value.findIndex((d: Download) => d.id === download.id)
    if (index > -1) {
      downloads.value.splice(index, 1)
    }
    downloadManagers.delete(download.id)
  }

  function getButtonText(status: DownloadStatus): string {
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

  function getStatusText(status: DownloadStatus): string {
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

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  function formatSpeed(bytesPerSecond: number): string {
    return formatFileSize(bytesPerSecond) + '/s'
  }
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
