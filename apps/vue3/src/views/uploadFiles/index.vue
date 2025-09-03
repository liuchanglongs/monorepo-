<!-- 计算完一个切片就上传 -->
<template>
  <div class="file">
    <h1>多个文件上传</h1>
    <div class="box">
      <input type="file" @change="uploadFile" multiple />
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

  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  // 启用的线程数
  const THREAD_COUNT = 2
  // 同时上传个数
  const uploadNumber = 2

  const fileList = ref<fileInfoType[]>([])
  // 开启的线程
  const workers = ref<workersType[]>([])
  // 文件切片任务池
  const fileTaskPool = ref<{ [id: string]: taskChunkType[] }>({})
  // 上传切片任务词
  const uploadCunkPool = ref<{ [id: string]: chunkType[] }>({})

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

      // uploadNumber 与 THREAD_COUNT 算出同时上传个数： uploadNumber> THREAD_COUNT?
      //  workers 应该记录处理文件的id。 切好的chunk单独一个pool保存
      // 先写上传一个
      for (let index = 0; index < uploadNumber; index++) {
        if (index + 1 > data.length) {
          return
        }

        const { file, id, totalChunks } = fileList.value[index]
        const { data: uploadedChunks } = await getUploadedChunks(file.name)
        const number = uploadedChunks.length
        // 合并文件
        if (number == totalChunks) {
          mergeChunks(file.name)
          continue
        }
        fileList.value[index].uploadedTotal = uploadedChunks.length

        createFileTaskPool(file, id, totalChunks, uploadedChunks)

        // 更新信息
        workers.value[index].isBusy = true
        workers.value[index].handleFile = [id]
        assignTaskToWorker(index)
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

  // web worker执行 分配任务
  const assignTaskToWorker = (index: number) => {
    const { isBusy, handleFile, worker } = workers.value[index]
    if (isBusy && handleFile?.length) {
      let newHandleFile = [...handleFile]
      handleFile.forEach(fileId => {
        const task = fileTaskPool.value[fileId]
        if (task && task.length) {
          const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
          const { file, id } = fileList.value[fileInfoIndex]
          const taskItem: taskChunkType = fileTaskPool.value[fileId].shift()!
          const { chunkStart, chunkEnd } = taskItem
          worker.postMessage({ ...taskItem, chunkBlob: file.slice(chunkStart, chunkEnd) })
          // 异步的
          worker.onmessage = async e => {
            const chunk: chunkType = e.data
            // 添加上传的chunk
            if (!uploadCunkPool.value[id]) uploadCunkPool.value[id] = []
            uploadCunkPool.value[id].push(chunk)
            uploadChunk(id)
            // assignTaskToWorker(index)

            // await callBack(chunk, totalChunks, upLoadedChunks)
            // // 销毁线程
            // if (chunk.isDoneThread) {
            //   worker.terminate() // 终止当前worker线程
            // }
          }
        } else {
          newHandleFile = newHandleFile.filter(id => id != fileId)
          if (!newHandleFile.length) {
            delete fileTaskPool.value[fileId]
            // 更新当前worker的状态
            workers.value[index].handleFile = undefined
            workers.value[index].isBusy = false
          }
          // assignTaskToWorker(index)
        }
        assignTaskToWorker(index)
      })
    } else {
      console.log('该线程处理完,处于空闲状态', fileTaskPool.value)
      console.log('该线程处理完,处于空闲状态', workers)
      console.log('上传数据', uploadCunkPool.value)
      console.log('该线程处理完,处于空闲状态,需要重新分配任务')
    }
  }

  // 上传切片文件
  const uploadChunk = async (fileId: string) => {
    const controller = new AbortController()

    const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
    const { file, uploadedTotal, totalChunks } = fileList.value[fileInfoIndex]
    const chunk = uploadCunkPool.value[fileId].shift()!
    const { chunkStart, chunkEnd, chunkHash, chunkIndex } = chunk

    const fromData = new FormData()
    const fileName = file.name
    const chunkBlob = file.slice(chunkStart, chunkEnd)
    fromData.append('chunkHash', chunkHash)
    fromData.append('chunkFilename', fileName)
    fromData.append('chunkIndex', chunkIndex.toString())
    fromData.append('chunkBlob', chunkBlob)

    const timeoutId = setTimeout(() => controller.abort(), 60000)
    try {
      const res = await fetch('/api/file/upload1', {
        method: 'POST',
        body: fromData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.code === 200) {
        const currentUploadedTotal = uploadedTotal + 1
        console.log(fileName, currentUploadedTotal, totalChunks)
        fileList.value[fileInfoIndex].uploadedTotal = currentUploadedTotal
        if (currentUploadedTotal === totalChunks) {
          mergeChunks(fileName)
        }
        console.log(fileName, currentUploadedTotal, totalChunks)
      }
      // if (res.ok) {
      //   clearTimeout(timeoutId)
      //   upLoadedChunks.push({ ...chunk, uploaded: true })
      //   updateProgress(upLoadedChunks.length * CHUNK_SIZE, file.size, CHUNK_SIZE)
      //   if (totalChunks === upLoadedChunks.length) {
      //     await mergeChunks(file.name)
      //   }
      //   return true
      // }
      // return false
    } catch (error) {
      clearTimeout(timeoutId)
      // return false
    }
  }

  // 合并切片文件
  const mergeChunks = async (fileName: string) => {
    const response = await fetch('/api/file/merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: fileName }),
    })
    // reset()
    if (response.ok) {
      // markAsSuccess()
      ElMessage({
        message: '上传成功',
        type: 'success',
      })
    }
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
