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
          chunks: [],
          totalChunks,
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
        createFileTaskPool(file, id, totalChunks)
        // 更新信息
        workers.value[index].isBusy = true
        workers.value[index].handleFile = [id]
        assignTaskToWorker(index)
      }
    }
  }
  // 为文件创建任务池
  const createFileTaskPool = (file: File, fileId: string, totalChunks: number) => {
    const chunk: taskChunkType[] = []
    const size = file.size
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
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

  // web worker执行 分配任务
  const assignTaskToWorker = (index: number) => {
    const { isBusy, handleFile, worker } = workers.value[index]

    if (isBusy && handleFile?.length) {
      let newHandleFile = [...handleFile]
      handleFile.forEach(fileId => {
        const task = fileTaskPool.value[fileId]
        if (task && task.length) {
          const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
          const { file } = fileList.value[fileInfoIndex]
          const taskItem: taskChunkType = fileTaskPool.value[fileId].shift()!
          const { chunkStart, chunkEnd } = taskItem
          worker.postMessage({ ...taskItem, chunkBlob: file.slice(chunkStart, chunkEnd) })
          // 异步的
          worker.onmessage = async e => {
            const chunk: chunkType = e.data
            // 添加chunk
            fileList.value[index].chunks.push(chunk)

            assignTaskToWorker(index)

            // await callBack(chunk, totalChunks, upLoadedChunks)
            // // 销毁线程
            // if (chunk.isDoneThread) {
            //   worker.terminate() // 终止当前worker线程
            // }
          }
        } else {
          newHandleFile = newHandleFile.filter(id => id != fileId)
          delete fileTaskPool.value[fileId]
          if (!newHandleFile.length) {
            // 更新当前worker的状态
            workers.value[index].handleFile = undefined
            workers.value[index].isBusy = false
          }
          assignTaskToWorker(index)
        }
      })
    } else {
      console.log('该线程处理完,处于空闲状态', fileList.value)
      console.log('该线程处理完,处于空闲状态', workers)
      console.log('该线程处理完,处于空闲状态,需要重新分配任务')
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
