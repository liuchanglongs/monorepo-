<!-- 计算完一个切片就上传 -->
<template>
  <div class="file">
    <div>
      输入是否卡顿：<input style="width: 240px" placeholder="Please input" @input="input" />
    </div>
    <h1>文件上传：启用webwork</h1>
    <div>
      <input type="file" @change="uploadFile" />
    </div>
  </div>
</template>
<script setup lang="ts">
  import type { chunkType } from './utils/worker'
  import { cutFile } from './utils/cutFile'
  import { onMounted } from 'vue'
  import { useRequestQueue } from './utils/useRequestQueue'
  onMounted(() => {
    // 初始化一些操作
  })
  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  const THREAD_COUNT = navigator.hardwareConcurrency || 4 // 并发上传数量
  const { addRequest } = useRequestQueue()
  console.log('THREAD_COUNT', THREAD_COUNT)

  const uploadFile = async (event: Event): Promise<any> => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const file = files[0]
      const { data: uploadedChunks } = await getUploadedChunks(file.name)
      await cutFile(
        file,
        CHUNK_SIZE,
        THREAD_COUNT,
        uploadedChunks,
        async (chunk: chunkType, totalChunks: number, upLoadedChunks: chunkType[]) => {
          // 切片上传
          if (!chunk.uploaded) {
            addRequest(async () => {
              const res = await uploadChunk(chunk, file.name)
              // if (!res) {
              //   throw Error('请求失败')
              // }
              upLoadedChunks.push({ ...chunk, uploaded: true })
              if (totalChunks === upLoadedChunks.length) {
                await mergeChunks(file.name)
              }
            })
          } else {
            // 该切片已经上传
            upLoadedChunks.push({ ...chunk })
          }
          // 全部上传完合并：mer接口失败的时候
          if (totalChunks === upLoadedChunks.length) {
            await mergeChunks(file.name)
          }
        }
      )
    }
  }
  // 上传切片文件
  const uploadChunk = async (chunk: chunkType, fileName: string) => {
    const fromData = new FormData()
    const { chunkBlob, chunkHash, chunkIndex } = chunk
    fromData.append('chunkHash', chunkHash || '')
    fromData.append('chunkFilename', fileName)
    fromData.append('chunkIndex', chunkIndex.toString())
    fromData.append('chunkBlob', chunkBlob || '')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch('/api/file/upload', {
        method: 'POST',
        body: fromData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      console.log('/api/file/upload:', data)

      if (res.ok) {
        clearTimeout(timeoutId)
        return true
      }
      return false
    } catch (error) {
      clearTimeout(timeoutId)
      return false
    }
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

  const input = (event: Event): void => {
    const target = event.target as HTMLInputElement
    // ElMessage.primary(`This is a primary message: ${target.value}`)
    console.log('input:', target.value)
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
