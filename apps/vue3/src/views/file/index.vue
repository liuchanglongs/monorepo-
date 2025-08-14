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
  import type { chunkType } from './utils/worker'
  import { cutFile } from './utils/cutFile'
  import { onMounted } from 'vue'
  onMounted(() => {
    // 初始化一些操作
  })
  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  const THREAD_COUNT = navigator.hardwareConcurrency || 4 // 并发上传数量

  const uploadFile = async (event: Event): Promise<any> => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const file = files[0]
      const { data: uploadedChunks } = await getUploadedChunks(file.name)
      const chunksArry: chunkType[] = await cutFile(file, CHUNK_SIZE, THREAD_COUNT, uploadedChunks)
      let uploadedCount = 0 // 已上传的切片数量
      // 暂时一个接着一个发请求
      for (let i = 0; i < chunksArry.length; i++) {
        const chunk = chunksArry[i]
        if (chunk.uploaded) {
          uploadedCount++
          if (uploadedCount === chunksArry.length) {
            // 如果所有切片都上传成功，合并切片
            await mergeChunks(file.name)
          }
          continue
        }
        await uploadChunk(chunk, file.name, chunksArry, i)
      }
    }
    console.log('end')
  }
  // 上传切片文件
  const uploadChunk = async (
    chunk: chunkType,
    fileName: string,
    chunks: chunkType[],
    index: number
  ) => {
    const fromData = new FormData()
    const { chunkBlob, chunkHash, chunkIndex } = chunk
    fromData.append('chunkBlob', chunkBlob || '')
    fromData.append('chunkHash', chunkHash || '')
    fromData.append('chunkFilename', fileName)
    fromData.append('chunkIndex', chunkIndex.toString())
    chunks[index].uploaded = true // 标记为已上传
    await fetch('/api/file/upload', {
      method: 'POST',
      body: fromData,
    })

    // if (chunks.every(item => item.uploaded)) {
    //   // 如果所有切片都上传成功，合并切片
    //   await mergeChunks(fileName)

    // }
    // 上传成功
  }
  // 获取已经上传切片的接口
  const getUploadedChunks = async (fileName: string): Promise<any> => {
    const response = await fetch(`/api/file/get-uploaded-chunks?fileName=${fileName}`)
    if (!response.ok) {
      throw new Error('Failed to fetch uploaded chunks')
    }
    return response.json()
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
    console.log(response)
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
