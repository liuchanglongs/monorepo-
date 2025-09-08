<!-- 计算完一个切片就上传 -->
<template>
  <div class="file">
    <h1>多个文件上传</h1>
    <div class="box">
      <input type="file" @change="uploadFile" multiple />
      <div>
        <div v-for="(worker, index) in workers" :key="index" style="display: flex">
          <div>worker({{ index }}): {{ worker.isBusy ? '忙碌' : '空闲' }}</div>
          <div style="margin-left: 18px">当前处理的文件: {{ worker.handleFile || '无' }}</div>
        </div>
      </div>
      <div class="progress" v-for="info in fileList">
        <span class="seed">{{ info.seed }}/s</span>
        <el-progress :percentage="info.progress" />
        <el-icon><VideoPause /></el-icon>
        <el-icon><VideoPlay /></el-icon>
        <el-icon><RefreshRight /></el-icon>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { onUnmounted, ref } from 'vue'
  import type { chunkType, fileIdType, fileInfoType, taskChunkType, workersType } from './type'
  import { onMounted } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useRequestQueue } from './utils/useRequestQueue'

  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  // 启用的线程数
  const THREAD_COUNT = 2
  // 同时上传个数：必须小于等于请求线程数、批量请求数量限制
  const uploadNumber = 2

  const fileList = ref<fileInfoType[]>([])
  // 开启的线程
  const workers = ref<workersType[]>([])
  // 文件切片任务池
  const fileTaskPool = ref<{ [id: string]: taskChunkType[] }>({})
  // 上传切片任务池
  const uploadCunkPool = ref<{ [id: string]: chunkType[] }>({})
  const { processQueue, assignFileRequest } = useRequestQueue(uploadCunkPool)

  onMounted(() => {
    //  启动web worker
    // const THREAD_COUNT = navigator.hardwareConcurrency || 2
    console.log('navigator.hardwareConcurrency ', navigator.hardwareConcurrency)

    // 先默认给两个,一个文件
    const data: workersType[] = []
    for (let index = 0; index < THREAD_COUNT; index++) {
      const worker = new Worker(new URL('./utils/worker.ts', import.meta.url), { type: 'module' })
      data.push({ worker, isBusy: false })
    }
    workers.value = data
  })
  onUnmounted(() => {
    workers.value.forEach(v => v.worker.terminate())
    workers.value = []
  })

  const uploadFile = async (event: Event): Promise<any> => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const data: fileInfoType[] = Array.from(files).map((file, index) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
        return {
          id: file.name + index,
          file,
          status: 'pending',
          progress: 0,
          seed: 0,
          totalChunks,
          uploadedTotal: 0,
        }
      })
      fileList.value = data

      // 开始上传:至少有一个线程处理一个文件
      const count = data.length >= uploadNumber ? uploadNumber : data.length
      for (let index = 0; index < count; index++) {
        const { file, id, totalChunks } = fileList.value[index]
        const { data: uploadedChunks } = await getUploadedChunks(file.name)
        const number = uploadedChunks.length
        // 合并文件
        if (number == totalChunks) {
          mergeChunks(file.name, index)
          continue
        }
        fileList.value[index].uploadedTotal = uploadedChunks.length

        createFileTaskPool(file, id, totalChunks, uploadedChunks)
        assignFileRequest(id)
        assignWorkerFile(id, index)
      }
      // 分配剩余的线程
      assignWorkerFile()
    }
  }
  /***
   * 给worker分配处理文件片任务
   * 1. uploadNumber个文件，每个文件分配一个线程, 线程不够分就调整uploadNumber
   * 开始上传:至少有一个线程处理一个文件；合并完成后开始处理下一个文件
   * 2. 分配剩余的线程：
   * 规则：优先分配给size大的文件
   * 3. 文件合并完成后，，分配给其它文件
   * */
  const assignWorkerFile = (fileId?: fileIdType, workerIndex?: number) => {
    if (typeof workerIndex === 'number' && fileId) {
      // 给worker分配处理文件片任务
      workers.value[workerIndex].isBusy = true
      workers.value[workerIndex].handleFile = fileId
      // 执行任务
      assignTaskToWorker(workerIndex)
    } else {
      /***
       * 分配剩余的线程：
       * 1. 是否有多余的线程：没有就不分配
       * 2. 有：分配给正在上传的文件
       * */
      for (let index = 0; index < workers.value.length; index++) {
        if (workers.value[index].isBusy) continue
        const pendingFile = fileList.value.filter(v => v.status === 'uploading')
        const sortData = pendingFile.sort((a, b) => b.file.size - a.file.size)
        const { id: fileId, totalChunks } = sortData[0]
        const fileTaskPoolItem = fileTaskPool.value[fileId]
        if (sortData.length && fileTaskPoolItem && fileTaskPoolItem.length) {
          const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
          workers.value[index].isBusy = true
          workers.value[index].handleFile = fileId
          fileList.value[fileInfoIndex].status = 'uploading'

          assignTaskToWorker(index)
        } else {
          // 这次上传完的文件处理完了：其它的文件在merge成功后会重新分配
          break
        }
      }
    }
  }
  // 为文件创建任务池
  const createFileTaskPool = (
    file: File,
    fileId: string,
    totalChunks: number,
    uploadedChunks: string[]
  ) => {
    const chunk: taskChunkType[] = []
    const size = file.size
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (uploadedChunks.includes(String(chunkIndex))) continue
      const chunkStart = chunkIndex * CHUNK_SIZE
      let chunkEnd = (chunkIndex + 1) * CHUNK_SIZE
      if (chunkEnd > size) {
        chunkEnd = size
      }
      chunk.push({
        chunkIndex,
        chunkStart,
        chunkEnd,
      })
    }
    fileTaskPool.value[fileId] = chunk
  }

  // 获取已经上传切片的接口
  const getUploadedChunks = async (fileName: string): Promise<any> => {
    const response = await fetch(`/api/file/get-uploaded-chunks?fileName=${fileName}`)

    if (!response.ok) {
      throw new Error('Failed to fetch uploaded chunks')
    }
    return response.json()
  }

  /**
   * web worker执行 分配任务
   * */
  const assignTaskToWorker = (workerindex: number) => {
    const { isBusy, handleFile: fileId, worker } = workers.value[workerindex]
    if (isBusy && fileId) {
      const task = fileTaskPool.value[fileId]
      if (task && task.length) {
        const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
        const { file } = fileList.value[fileInfoIndex]
        fileList.value[fileInfoIndex].status = 'uploading'
        const taskItem: taskChunkType = fileTaskPool.value[fileId].shift()!
        const { chunkStart, chunkEnd } = taskItem
        worker.postMessage({ ...taskItem, chunkBlob: file.slice(chunkStart, chunkEnd) })
        // 异步的
        worker.onmessage = async e => {
          const chunk: chunkType = e.data
          const { id } = fileList.value[fileInfoIndex]
          // 添加上传的chunk
          if (!uploadCunkPool.value[id]) uploadCunkPool.value[id] = []
          uploadCunkPool.value[id].push(chunk)
          assignTaskToWorker(workerindex)
          processQueue(id)
          // uploadChunk(id)
          // await callBack(chunk, totalChunks, upLoadedChunks)
        }
      } else {
        delete fileTaskPool.value[fileId]
        // 更新当前worker的状态
        workers.value[workerindex].handleFile = undefined
        workers.value[workerindex].isBusy = false
        assignTaskToWorker(workerindex)
      }
    } else {
      // 当前worker空闲，分配其它文件
      assignWorkerFile()
    }
  }

  // 上传切片文件
  const uploadChunk = async (fileId: string) => {
    const controller = new AbortController()
    const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
    const { file } = fileList.value[fileInfoIndex]
    const chunk = uploadCunkPool.value[fileId].shift()!
    const { chunkStart, chunkEnd, chunkHash, chunkIndex } = chunk

    const fromData = new FormData()
    const fileName = file.name
    const chunkBlob = file.slice(chunkStart, chunkEnd)
    fromData.append('chunkHash', chunkHash)
    fromData.append('chunkFilename', fileName)
    fromData.append('chunkIndex', chunkIndex.toString())
    fromData.append('chunkBlob', chunkBlob)

    // // const timeoutId = setTimeout(() => controller.abort(), 60000)
    // try {
    //   const res = await fetch('/api/file/upload1', {
    //     method: 'POST',
    //     body: fromData,
    //     signal: controller.signal,
    //   })
    //   // clearTimeout(timeoutId)
    //   const data = await res.json()
    //   if (data.code === 200) {
    //     /**
    //      * 为什么要重新获取？不适用外面的变量 uploadedTotal, totalChunks
    //      * */
    //     const { uploadedTotal, totalChunks } = fileList.value[fileInfoIndex]
    //     const currentUploadedTotal = uploadedTotal + 1
    //     fileList.value[fileInfoIndex].uploadedTotal = currentUploadedTotal

    //     if (currentUploadedTotal === totalChunks) {
    //       mergeChunks(fileName)
    //     }
    //   }

    // } catch (error) {

    // }

    // 模拟请求
    const { currentUploadedTotal, totalChunks } = await new Promise<{
      currentUploadedTotal: any
      totalChunks: any
    }>(resolve => {
      setTimeout(() => {
        const { uploadedTotal, totalChunks } = fileList.value[fileInfoIndex]
        const currentUploadedTotal = uploadedTotal + 1
        fileList.value[fileInfoIndex].uploadedTotal = currentUploadedTotal
        resolve({ currentUploadedTotal, totalChunks })
      }, 2000)
    })
    if (currentUploadedTotal === totalChunks) {
      mergeChunks(fileName, fileInfoIndex)
    }
  }

  // 合并切片文件
  const mergeChunks = async (fileName: string, fileInfoIndex: number) => {
    console.log('合并文件', fileName, fileList.value[fileInfoIndex])

    // const response = await fetch('/api/file/merge', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ fileName: fileName }),
    // })
    // // reset()
    // if (response.ok) {
    //   // markAsSuccess()
    //   ElMessage({
    //     message: '上传成功',
    //     type: 'success',
    //   })
    // }
  }
</script>
<style lang="scss" scoped>
  .file {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    background-color: #ffffff;
  }
  .progress {
    display: flex;
    align-items: center;
    .el-icon {
      margin-right: 6px;
      font-size: 24px;
      cursor: pointer;
    }
    .seed {
      margin-right: 12px;
    }
  }
  .el-progress--line {
    margin-right: 6px;
    width: 600px;
  }
</style>
