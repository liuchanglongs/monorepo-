<template>
  <div>
    <el-button @click="showOpenFilePicker">选择文件</el-button>
    <el-button @click="showDirectoryPicker">选择目录</el-button>
    <el-button @click="saveFile">saveFile</el-button>
    <el-button @click="continueSaveFile">continueSaveFile</el-button>
    <el-button @click="keepExistingData()">keepExistingData one</el-button>
    <el-button @click="keepExistingData('two')">keepExistingData two</el-button>

    <!-- 下载功能区域 -->
    <div style="margin-top: 20px; padding: 20px; border: 1px solid #ddd">
      <h3>下载功能</h3>
      <div style="margin-bottom: 10px">
        <el-input
          v-model="downloadUrl"
          placeholder="请输入下载链接"
          style="width: 400px; margin-right: 10px"
        />
        <el-button @click="startDownload" :disabled="isDownloading">开始下载</el-button>
      </div>

      <div style="margin-bottom: 10px">
        <el-button @click="pauseDownload" :disabled="!isDownloading || isPaused"
          >暂停下载</el-button
        >
        <el-button @click="resumeDownload" :disabled="!isPaused">继续下载</el-button>
        <el-button @click="restartDownload" :disabled="isDownloading && !isPaused"
          >重新下载</el-button
        >
        <el-button @click="cancelDownload" :disabled="!isDownloading && !isPaused"
          >取消下载</el-button
        >
      </div>

      <!-- 下载进度显示 -->
      <div v-if="downloadInfo.total > 0" style="margin-bottom: 10px">
        <el-progress :percentage="downloadProgress" :status="downloadStatus" :show-text="true" />
        <div style="margin-top: 5px; font-size: 12px; color: #666">
          已下载: {{ formatBytes(downloadInfo.loaded) }} / {{ formatBytes(downloadInfo.total) }} |
          速度: {{ downloadSpeed }} | 状态: {{ downloadStatusText }} | 文件: {{ currentFileName }}
        </div>
      </div>

      <!-- 调试信息 -->
      <div
        v-if="debugInfo.length > 0"
        style="
          margin-top: 10px;
          padding: 10px;
          background: #f5f5f5;
          font-size: 12px;
          max-height: 200px;
          overflow-y: auto;
        "
      >
        <div v-for="(info, index) in debugInfo" :key="index">{{ info }}</div>
      </div>
    </div>

    <!-- 原有的暂停/继续按钮 -->
    <div style="margin-top: 20px">
      <el-button @click="handle(true)" :disabled="paused">暂停</el-button>
      <el-button @click="handle(false)" :disabled="!paused">继续</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onUnmounted } from 'vue'

  const CHUNK_SIZE = 1024 * 1024 // 1MB 每片
  const TOTAL_CHUNKS = 10 // 总片数，模拟一个10MB的文件

  // 原有状态
  const paused = ref(false)
  const uploadNumber = ref<number>(2)

  // 下载相关状态
  const downloadUrl = ref('http://localhost:3023/file/download/4.mp4')
  const isDownloading = ref(false)
  const isPaused = ref(false)
  const currentFileName = ref('')
  const debugInfo = ref<string[]>([])
  const downloadInfo = ref({
    loaded: 0,
    total: 0,
    startTime: 0,
    pausedTime: 0,
    expectedHash: '', // 用于文件完整性验证
    actualHash: '',
  })

  const keepExistingDataDirHandle = ref(null)
  const keepExistingData = async (test?: any) => {
    if (!test) {
      test = '123456789'
      keepExistingDataDirHandle.value = await window.showDirectoryPicker({
        mode: 'readwrite', // 必须指定为 readwrite，否则无写入权限
        startIn: 'downloads', // 可选：默认从"下载"目录开始
        suggestedName: 'MySavedFiles', // 可选：建议的目录名（用户可修改）
      })
      const dirHandle = keepExistingDataDirHandle.value
      const fileHandle = await dirHandle.getFileHandle(
        'saved-demo-file.txt', // 要保存的文件名
        { create: true } // create: true 表示不存在时创建
      )
      // 4. 步骤4：写入内容到文件
      // 创建可写流（writable stream）
      const writable = await fileHandle.createWritable()
      /**
       * 写入内容（支持文本、Blob、ArrayBuffer 等）
       * 临时文件上的当前指针偏移处写入内容，有内容就覆盖内容
       * */
      await writable.write(test)
      await writable.close()
    } else {
      const dirHandle =
        keepExistingDataDirHandle.value ||
        (await window.showDirectoryPicker({
          mode: 'readwrite', // 必须指定为 readwrite，否则无写入权限
          startIn: 'downloads', // 可选：默认从"下载"目录开始
          suggestedName: 'MySavedFiles', // 可选：建议的目录名（用户可修改）
        }))

      const fileHandle = await dirHandle.getFileHandle(
        'saved-demo-file.txt', // 要保存的文件名
        { create: true } // create: true 表示不存在时创建
      )
      const existingFile = await fileHandle.getFile()
      const existingArrayBuffer = await existingFile.arrayBuffer()

      const position = existingArrayBuffer.byteLength || 0
      console.log('position', position)

      // 4. 步骤4：写入内容到文件
      // 创建可写流（writable stream）
      const writable = await fileHandle.createWritable({ keepExistingData: true })
      // 1. 写入内容（支持文本、Blob、ArrayBuffer 等）
      // await writable.write(test)// two456789
      // 2. 末尾写入内容：将文件当前的指针更新到指定的偏移位置
      // await writable.write({ type: 'seek', position })
      // await writable.write(test)
      // 3.
      await writable.write({ type: 'write', position, data: test })
      // 关闭流，完成写入（必须调用，否则文件可能损坏）
      await writable.close()
    }
  }

  // 下载控制器和读取器
  let abortController: AbortController | null = null
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let fileHandle: FileSystemFileHandle | null = null
  let writable: FileSystemWritableFileStream | null = null

  // 添加调试日志
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    debugInfo.value.push(`[${timestamp}] ${message}`)
    console.log(`[DEBUG] ${message}`)

    // 限制日志数量
    if (debugInfo.value.length > 50) {
      debugInfo.value = debugInfo.value.slice(-30)
    }
  }

  // 计算属性
  const downloadProgress = computed(() => {
    if (downloadInfo.value.total === 0) return 0
    return Math.round((downloadInfo.value.loaded / downloadInfo.value.total) * 100)
  })

  const downloadStatus = computed(() => {
    if (isPaused.value) return 'warning'
    if (isDownloading.value) return 'active'
    if (downloadProgress.value === 100) return 'success'
    return 'normal'
  })

  const downloadStatusText = computed(() => {
    if (isPaused.value) return '已暂停'
    if (isDownloading.value) return '下载中'
    if (downloadProgress.value === 100) return '下载完成'
    return '等待下载'
  })

  const downloadSpeed = ref('0 KB/s')

  // 格式化字节数
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 从URL提取正确的文件名
  const extractFileName = (url: string, contentDisposition?: string): string => {
    // 优先从 Content-Disposition 头获取文件名
    if (contentDisposition) {
      const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (matches && matches[1]) {
        return matches[1].replace(/['"]/g, '')
      }
    }

    // 从URL提取文件名，移除查询参数
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const fileName = pathname.split('/').pop() || 'download'

      // 如果没有扩展名，尝试从Content-Type推断
      if (!fileName.includes('.')) {
        return `${fileName}.file`
      }

      return fileName
    } catch {
      return `download_${Date.now()}.file`
    }
  }

  // 计算下载速度
  const calculateSpeed = () => {
    const now = Date.now()
    const elapsed = (now - downloadInfo.value.startTime - downloadInfo.value.pausedTime) / 1000
    if (elapsed > 0) {
      const speed = downloadInfo.value.loaded / elapsed
      downloadSpeed.value = formatBytes(speed) + '/s'
    }
  }

  // 开始下载
  const startDownload = async () => {
    if (!downloadUrl.value.trim()) {
      addDebugLog('错误：请输入下载链接')
      return
    }

    try {
      // 清空调试信息
      debugInfo.value = []
      addDebugLog('开始下载流程...')

      // 选择保存目录
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads',
      })

      // 先发起HEAD请求获取文件信息
      addDebugLog('获取文件信息...')
      const headResponse = await fetch(downloadUrl.value, { method: 'HEAD' })
      const contentLength = headResponse.headers.get('content-length')
      const contentDisposition = headResponse.headers.get('content-disposition')
      const contentType = headResponse.headers.get('content-type')

      // 提取正确的文件名
      const fileName = extractFileName(downloadUrl.value, contentDisposition)
      currentFileName.value = fileName
      addDebugLog(`文件名: ${fileName}`)

      // 创建文件句柄
      fileHandle = await dirHandle.getFileHandle(fileName, { create: true })

      // 重置状态
      downloadInfo.value = {
        loaded: 0,
        total: contentLength ? parseInt(contentLength, 10) : 0,
        startTime: Date.now(),
        pausedTime: 0,
        expectedHash: '',
        actualHash: '',
      }

      addDebugLog(`文件大小: ${formatBytes(downloadInfo.value.total)}`)
      addDebugLog(`Content-Type: ${contentType}`)

      isDownloading.value = true
      isPaused.value = false

      // 创建中止控制器
      abortController = new AbortController()

      // 发起下载请求
      const response = await fetch(downloadUrl.value, {
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 获取响应流
      const responseStream = response.body
      if (!responseStream) {
        throw new Error('无法获取响应流')
      }

      reader = responseStream.getReader()

      // 创建可写流 - 重新创建文件，确保文件是空的
      writable = await fileHandle.createWritable()

      addDebugLog('开始下载数据...')

      // 开始读取数据
      await readStream()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addDebugLog('下载已取消')
      } else {
        addDebugLog(`下载失败: ${error.message}`)
      }
      await cleanupDownload()
    }
  }

  // 读取流数据
  const readStream = async () => {
    if (!reader || !writable) return

    try {
      while (true) {
        // 检查是否暂停
        if (isPaused.value) {
          addDebugLog('检测到暂停信号，停止读取')
          break
        }

        const { done, value } = await reader.read()

        if (done) {
          // 下载完成
          await writable.close()
          writable = null
          isDownloading.value = false

          addDebugLog('下载完成!')
          addDebugLog(`总大小: ${formatBytes(downloadInfo.value.loaded)}`)

          // 验证文件完整性
          await verifyFileIntegrity()
          break
        }

        if (value) {
          try {
            // 写入数据到文件
            await writable.write(value)

            // 更新进度
            downloadInfo.value.loaded += value.length
            calculateSpeed()

            // 每10MB输出一次进度
            if (downloadInfo.value.loaded % (10 * 1024 * 1024) < value.length) {
              addDebugLog(
                `下载进度: ${formatBytes(downloadInfo.value.loaded)} / ${formatBytes(downloadInfo.value.total)} (${downloadProgress.value}%)`
              )
            }
          } catch (writeError) {
            addDebugLog(`写入文件失败: ${writeError}`)
            throw writeError
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        addDebugLog(`读取流失败: ${error.message}`)
        throw error
      }
    }
  }

  // 验证文件完整性
  const verifyFileIntegrity = async () => {
    if (!fileHandle) return

    try {
      const file = await fileHandle.getFile()
      const actualSize = file.size
      const expectedSize = downloadInfo.value.total

      addDebugLog(
        `文件完整性验证 - 期望大小: ${formatBytes(expectedSize)}, 实际大小: ${formatBytes(actualSize)}`
      )

      if (expectedSize > 0 && actualSize !== expectedSize) {
        addDebugLog(`警告: 文件大小不匹配!`)
        return false
      }

      addDebugLog('文件完整性验证通过')
      return true
    } catch (error) {
      addDebugLog(`文件完整性验证失败: ${error}`)
      return false
    }
  }

  // 暂停下载
  const pauseDownload = async () => {
    if (!isDownloading.value || isPaused.value) return

    addDebugLog('开始暂停下载...')
    isPaused.value = true
    const pauseStartTime = Date.now()

    // 取消当前请求
    if (abortController) {
      abortController.abort()
    }

    // 关闭当前的读取器
    if (reader) {
      try {
        await reader.cancel()
      } catch (e) {
        // 忽略取消错误
      }
      reader = null
    }

    // 关闭写入流
    if (writable) {
      try {
        await writable.close()
      } catch (e) {
        // 忽略关闭错误
      }
      writable = null
    }

    downloadInfo.value.pausedTime += Date.now() - pauseStartTime
    addDebugLog(`下载已暂停，已下载: ${formatBytes(downloadInfo.value.loaded)}`)
  }

  // 继续下载 - 修复版本
  const resumeDownload = async () => {
    if (!isPaused.value || !fileHandle) return

    try {
      addDebugLog('开始恢复下载...')
      addDebugLog(`从字节位置 ${downloadInfo.value.loaded} 继续下载`)

      isPaused.value = false

      // 创建新的中止控制器
      abortController = new AbortController()

      // 使用Range请求从断点继续
      const response = await fetch(downloadUrl.value, {
        headers: {
          Range: `bytes=${downloadInfo.value.loaded}-`,
        },
        signal: abortController.signal,
      })

      addDebugLog(`Range请求响应状态: ${response.status}`)

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 检查响应头
      const contentRange = response.headers.get('content-range')
      if (contentRange) {
        addDebugLog(`Content-Range: ${contentRange}`)
      }

      const responseStream = response.body
      if (!responseStream) {
        throw new Error('无法获取响应流')
      }

      reader = responseStream.getReader()

      // 关键修复：获取现有文件内容，然后重新创建包含现有数据的文件
      const existingFile = await fileHandle.getFile()
      const existingArrayBuffer = await existingFile.arrayBuffer()

      addDebugLog(`现有文件大小: ${existingArrayBuffer.byteLength} 字节`)

      // 重新创建可写流
      writable = await fileHandle.createWritable({ keepExistingData: true })
      // writable = await fileHandle.createWritable()

      // 先写入现有数据
      // if (existingArrayBuffer.byteLength > 0) {
      //   await writable.write(existingArrayBuffer)
      //   addDebugLog(`已写入现有数据: ${existingArrayBuffer.byteLength} 字节`)
      // }

      addDebugLog('开始写入新数据...')
      // 设置写入位置
      await writable.write({ type: 'seek', position: existingArrayBuffer.byteLength })
      // 继续读取剩余数据
      await readStream()
    } catch (error: any) {
      addDebugLog(`继续下载失败: ${error.message}`)
      await cleanupDownload()
    }
  }

  // 重新下载
  const restartDownload = async () => {
    addDebugLog('重新开始下载...')
    await cancelDownload()

    // 重置所有状态
    downloadInfo.value = {
      loaded: 0,
      total: 0,
      startTime: 0,
      pausedTime: 0,
      expectedHash: '',
      actualHash: '',
    }
    currentFileName.value = ''

    // 重新开始下载
    await startDownload()
  }

  // 取消下载
  const cancelDownload = async () => {
    addDebugLog('正在取消下载...')

    // 中止请求
    if (abortController) {
      abortController.abort()
      abortController = null
    }

    await cleanupDownload()
    addDebugLog('下载已取消')
  }

  // 清理下载资源
  const cleanupDownload = async () => {
    isDownloading.value = false
    isPaused.value = false

    if (reader) {
      try {
        await reader.cancel()
      } catch (e) {
        // 忽略取消错误
      }
      reader = null
    }

    if (writable) {
      try {
        await writable.close()
      } catch (e) {
        // 忽略关闭错误
      }
      writable = null
    }

    fileHandle = null
    downloadSpeed.value = '0 KB/s'
  }

  // 组件卸载时清理资源
  onUnmounted(() => {
    cleanupDownload()
  })

  // ... existing code ...
  const showOpenFilePicker = async () => {
    // 获取 OPFS 根目录（Chromium）
    const opfsRoot = await navigator.storage.getDirectory()

    // 创建或获取文件/目录
    const fileHandle = await opfsRoot.getFileHandle('my first file', { create: true })
    const dirHandle = await opfsRoot.getDirectoryHandle('my first folder', { create: true })
    // 在子目录创建文件
    const nestedFile = await dirHandle.getFileHandle('my nested file', { create: true })
    const writable = await nestedFile.createWritable()
    await writable.write('hello OPFS')
    await writable.close()

    // 读取文件
    const file = await nestedFile.getFile()
    const text = await file.text()
    console.log(text) // 'hello OPFS'
  }

  const showDirectoryPicker = async () => {
    if (window.showDirectoryPicker) {
      const directory = await window.showDirectoryPicker()
      console.log(directory)
    } else {
      console.error('showDirectoryPicker is not supported in this browser.')
    }
  }

  const saveFile = async () => {
    try {
      // 1. 步骤1：让用户选择目标目录（需用户授权）
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite', // 必须指定为 readwrite，否则无写入权限
        startIn: 'downloads', // 可选：默认从"下载"目录开始
        suggestedName: 'MySavedFiles', // 可选：建议的目录名（用户可修改）
      })
      console.log(`已选择目录：${dirHandle.name}`)

      // 2. 步骤2：在选中的目录中，创建/获取目标文件的句柄
      // 若文件已存在，会覆盖；若不存在，会新建
      const fileHandle = await dirHandle.getFileHandle(
        'saved-demo-file.txt', // 要保存的文件名
        { create: true } // create: true 表示不存在时创建
      )

      console.log(` → 准备保存文件：${fileHandle.name}`)

      // 3. 步骤3：定义要保存的文件内容（可自定义，如文本、JSON、二进制数据等）
      const fileContent = {
        title: '前端保存的文件',
        content: '使用 File API + FileSystem API 实现目录选择后保存文件',
        timestamp: new Date().toLocaleString(),
      }
      // 转为文本格式（若需保存二进制，可直接传入 ArrayBuffer 等）
      const contentText = JSON.stringify(fileContent, null, 2)

      // 4. 步骤4：写入内容到文件
      // 创建可写流（writable stream）
      const writable = await fileHandle.createWritable()
      // 写入内容（支持文本、Blob、ArrayBuffer 等）
      await writable.write(contentText)
      // 关闭流，完成写入（必须调用，否则文件可能损坏）
      await writable.close()

      // 5. 提示成功
      console.log(`文件保存成功！路径：${dirHandle.name}/${fileHandle.name}`)
      console.log(`文件已保存到：${dirHandle.name} 目录下的 ${fileHandle.name}`)
    } catch (error) {
      // 捕获错误（如用户取消选择、无权限、浏览器不支持等）
      if (error.name === 'AbortError') {
        console.log('用户取消了目录选择')
      } else if (error.name === 'NotAllowedError') {
        console.log('无目录写入权限，请重试')
      } else if (error.name === 'TypeError') {
        console.log('浏览器不支持文件系统访问 API（需 HTTPS 环境）')
      } else {
        console.log(`保存失败：${error.message}`)
      }
      console.error('详细错误：', error)
    }
  }

  const continueSaveFile = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads',
        suggestedName: 'StreamFiles',
      })
      // 创建文件句柄
      const fileHandle = await dirHandle.getFileHandle(
        `streamed-file-${new Date().getTime()}.txt`,
        { create: true }
      )
      // 创建可写流
      const writable = await fileHandle.createWritable()

      // 分片写入数据
      for (let i = 0; i < TOTAL_CHUNKS; i++) {
        // 生成当前分片的数据（实际应用中可以是从网络流、本地文件等获取的数据）
        const chunkData = generateChunkData(i)

        // 写入当前分片
        // https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemWritableFileStream/write

        await writable.write(chunkData)

        // 模拟网络延迟或处理时间
        await new Promise(resolve => setTimeout(resolve, 500))
        console.log(i)
      }
      // 完成写入并关闭流
      await writable.close()
    } catch (error) {
      console.log(error)
    }
  }

  // 生成分片数据（实际应用中可替换为真实数据源）
  const generateChunkData = chunkIndex => {
    // 可以根据需要返回不同格式：ArrayBuffer, Uint8Array, Blob 或字符串
    return new Blob([chunkIndex], { type: 'application/octet-stream' })
  }

  const handle = (isPaused: boolean) => {
    if (isPaused) {
      console.log('zanting')
    } else {
      console.log('jixu')
    }
    paused.value = isPaused
  }
</script>

<style scoped></style>
