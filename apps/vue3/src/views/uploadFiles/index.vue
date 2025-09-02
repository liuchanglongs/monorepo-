<!-- 计算完一个切片就上传 -->
<template>
  <div class="file">
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
  import type { chunkType, fileIdType, fileInfoType, workersType } from './type'
  import { onMounted } from 'vue'

  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  const fileList = ref<fileInfoType[]>([])
  // 开启的线程
  const workers = ref<workersType[]>([])
  // 文件切片队列
  const fileTaskQueue = ref<Map<fileIdType, chunkType[]>>(new Map())

  onMounted(() => {
    //  启动web worker
    // const THREAD_COUNT = navigator.hardwareConcurrency || 2
    // 先默认给两个,一个文件
    const THREAD_COUNT = 2
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
          id: index,
          file,
          status: 'pending',
          progress: 0,
          seed: 0,
          chunks: [],
          totalChunks,
        }
      })
      fileList.value = data
      // 开始根据work数量进行分配调度
      const number = workers.value.length
      for (let index = 0; index < number; index++) {
        const worker = workers.value[index]
        const { file, id } = fileList.value[index]
      }
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
