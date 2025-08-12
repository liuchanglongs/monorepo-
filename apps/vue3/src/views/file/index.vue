<template>
  <div class="file">
    <div>
      输入是否卡顿：<input style="width: 240px" placeholder="Please input" @input="input" />
    </div>
    <h1>文件上传：启用webwork</h1>
    <div>
      <input type="file" @change="uploadFile" />
    </div>
    <h1>文件上传：不用webwork</h1>
    <div>
      <input type="file" @change="uploadFile1" />
      <el-button :plain="true" @click="open5">Primary</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import SparkMD5 from 'spark-md5'
  import { createChunkFn } from './utils/fn'

  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  const THREAD_COUNT = navigator.hardwareConcurrency || 4 // 并发上传数量

  const uploadFile = (event: Event): void => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const file = files[0]
      // 切片数量
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      // 计算并发上传数量；每个线程需要的切片数量
      const concurrentUploads = Math.ceil(totalChunks / THREAD_COUNT)
      console.log('切片数量:', totalChunks)
      console.log('线程数量:', THREAD_COUNT)
      console.log('每个线程需要的切片数量:', concurrentUploads)

      for (let index = 0; index < THREAD_COUNT; index++) {
        const start = index * concurrentUploads
        let end = start + concurrentUploads
        if (totalChunks < end) {
          end = totalChunks
        }
        // 关键配置：启用模块模式
        const worker = new Worker(new URL('./utils/worker.ts', import.meta.url), { type: 'module' })
        // const worker = new Worker('/worker.ts')
        worker.postMessage({
          file,
          start,
          end,
          chunkSize: CHUNK_SIZE,
        })
        worker.onmessage = e => {
          console.log('Worker:', e.data)
        }
        worker.onerror = error => {
          console.error(`Worker ${index} encountered an error:`, error)
        }
      }
    }
  }

  const uploadFile1 = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const file = files[0]
      // 切片数量
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      const result = []

      for (let index = 0; index < totalChunks; index++) {
        result.push(createChunkFn(file, index, CHUNK_SIZE))
      }
      const chunks = await Promise.all(result)
      console.log('chunks:', chunks)
      ElMessage.primary(`success`)
    }
  }

  const input = (event: Event): void => {
    const target = event.target as HTMLInputElement
    // ElMessage.primary(`This is a primary message: ${target.value}`)
    console.log('input:', target.value)
  }
  const open5 = () => {
    ElMessage.primary('This is a primary message.')
  }
</script>
<style lang="scss" scoped>
  .file {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    background-color: #f0f0f0;
  }
</style>
