<!-- 计算完一个切片就上传 -->
<template>
  <div class="file">
    <div class="box">
      <input type="file" @change="uploadFile" />
      <div class="progress">
        <span class="seed">{{ seed }}/s</span>
        <el-progress :percentage="percent" />
        <el-icon v-if="!isSuspend && status === 1" @click="onPause"><VideoPause /></el-icon>
        <el-icon v-if="isSuspend && status === 1" @click="onPlay"><VideoPlay /></el-icon>
        <el-icon v-if="status === 3" @click="onRefresh"><RefreshRight /></el-icon>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import type { chunkType } from './utils/worker'
  import { cutFile } from './utils/cutFile'
  import { onMounted } from 'vue'
  import type { uploadChunkProps } from './utils/useRequestQueue'
  import { useFileUploadProgress, useRequestQueue } from './utils/useRequestQueue'
  import { ElMessage } from 'element-plus'

  onMounted(() => {
    // 初始化一些操作
  })
  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  const THREAD_COUNT = navigator.hardwareConcurrency || 4 // 并发上传数量
  const { addRequest, isSuspend, cancleRequest, status, processQueue } = useRequestQueue()
  const { updateProgress, percent, seed, initStartTime, reset, markAsSuccess } =
    useFileUploadProgress()

  console.log('THREAD_COUNT', THREAD_COUNT)

  const uploadFile = async (event: Event): Promise<any> => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const file = files[0]
      const { data: uploadedChunks } = await getUploadedChunks(file.name)
      initStartTime()
      await cutFile(
        file,
        CHUNK_SIZE,
        THREAD_COUNT,
        uploadedChunks,
        async (chunk: chunkType, totalChunks: number, upLoadedChunks: chunkType[]) => {
          // 切片上传
          if (!chunk.uploaded) {
            const data: uploadChunkProps = {
              chunk,
              file,
              upLoadedChunks,
              totalChunks,
              CHUNK_SIZE,
            }
            addRequest({
              data,
              request: async (data: uploadChunkProps, controller: AbortController) => {
                return await uploadChunk(data, controller)
              },
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
  const uploadChunk = async (data: uploadChunkProps, controller: AbortController) => {
    const { file, chunk, upLoadedChunks, totalChunks, CHUNK_SIZE } = data
    const fromData = new FormData()
    const fileName = file.name
    const { chunkBlob, chunkHash, chunkIndex } = chunk
    fromData.append('chunkHash', chunkHash || '')
    fromData.append('chunkFilename', fileName)
    fromData.append('chunkIndex', chunkIndex.toString())
    fromData.append('chunkBlob', chunkBlob || '')

    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch('/api/file/upload1', {
        method: 'POST',
        body: fromData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (res.ok) {
        clearTimeout(timeoutId)

        upLoadedChunks.push({ ...chunk, uploaded: true })
        updateProgress(upLoadedChunks.length * CHUNK_SIZE, file.size, CHUNK_SIZE)
        if (totalChunks === upLoadedChunks.length) {
          await mergeChunks(file.name)
        }
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
    // reset()
    if (response.ok) {
      markAsSuccess()
      ElMessage({
        message: '上传成功',
        type: 'success',
      })
    }
    console.log(response)
  }

  const onPause = () => {
    isSuspend.value = true
    cancleRequest()
  }
  const onPlay = () => {
    isSuspend.value = false
    processQueue()
  }
  const onRefresh = () => {}
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
