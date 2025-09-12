<!-- 计算完一个切片就上传 -->
<template>
  <div class="file">
    <h1 @click="getData">多个文件上传</h1>
    <div class="box">
      <div style="display: flex; align-items: center">
        <span style="width: 150px">同时上传数量：</span>
        <el-select v-model="uploadNumber" size="small" placeholder="请选择">
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
          </el-option>
        </el-select>
      </div>
      <input type="file" @change="uploadFile" multiple />
      <div>
        <div v-for="(worker, index) in workers" :key="index" style="display: flex">
          <div>worker({{ index }}): {{ worker.isBusy ? '忙碌' : '空闲' }}</div>
          <div style="margin-left: 18px">当前处理的文件: {{ worker.handleFile || '无' }}</div>
        </div>
      </div>

      <div class="progress" v-for="(info, index) in fileList" :key="info.id">
        {{ info.file.name }}：
        <span class="seed">{{ info.seed }}/S</span>
        <el-progress :percentage="info.progress" />
        <el-button
          :disabled="info.status != 'uploading'"
          circle
          size="small"
          @click="onPaused(info, index)"
        >
          <el-icon><VideoPause /></el-icon
        ></el-button>
        <el-button
          @click="onContinueUpload(info, index)"
          :disabled="info.status != 'paused'"
          circle
          size="small"
        >
          <el-icon><VideoPlay /></el-icon
        ></el-button>
        <el-button :disabled="info.status != 'error'" circle size="small">
          <el-icon><RefreshRight /></el-icon
        ></el-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { onUnmounted, ref, watch } from 'vue'
  import type {
    chunkType,
    fileIdType,
    fileInfoType,
    taskChunkType,
    uploadChunkType,
    workersType,
  } from './type'
  import { onMounted } from 'vue'
  import { ElMessage } from 'element-plus'
  import {
    useUpdateFileUploadInfo,
    useRequestQueue,
    manageFileBindworkerIndex,
  } from './utils/useRequestQueue'
  const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB
  // 启用的线程数
  const THREAD_COUNT = 3
  // 同时上传个数：必须小于等于请求线程数、批量请求数量限制
  // 如果设计成同时上传个数 > 线程数：那么一个worker处理列表：
  // handleFile?: fileIdType[]

  const uploadNumber = ref<number>(2)
  watch(uploadNumber, (newVal, old) => {
    changeUploadNumber(newVal, old)
  })

  const options = [
    {
      value: 1,
      label: '同时上传一个',
    },
    {
      value: 2,
      label: '同时上传两个',
    },
    {
      value: 3,
      label: '同时上传三个',
    },
  ]

  const fileList = ref<fileInfoType[]>([])
  // 开启的线程
  const workers = ref<workersType[]>([])
  // 文件切片任务池
  const fileTaskPool = ref<{ [id: string]: taskChunkType[] }>({})
  // 上传切片任务池
  const uploadCunkPool = ref<{ [id: string]: chunkType[] }>({})
  const { updateFileProgress, updateFileSeed } = useUpdateFileUploadInfo(fileList)
  onMounted(() => {
    //  启动web worker
    // const THREAD_COUNT = navigator.hardwareConcurrency || 2
    // console.log('navigator.hardwareConcurrency ', navigator.hardwareConcurrency)
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

  const getData = () => {
    console.log('fileList', fileList.value)
    console.log('uploadCunkPool', uploadCunkPool.value)
    console.log('fileTaskPool', fileTaskPool.value)
    console.log('works', workers.value)
    console.log('activeConfig', activeConfig.value)
  }

  // 上传切片文件
  const uploadChunk = async (props: uploadChunkType) => {
    const { fileId, controller, callBack } = props
    const chunk = uploadCunkPool.value[fileId].shift()!
    if (!chunk) return
    const { updateFileSeedCallBack, collectController } = callBack
    const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
    const { file } = fileList.value[fileInfoIndex]
    console.log('chunk', chunk)
    const { chunkStart, chunkEnd, chunkHash, chunkIndex } = chunk

    const fromData = new FormData()
    const fileName = file.name
    const chunkBlob = file.slice(chunkStart, chunkEnd)
    fromData.append('chunkHash', chunkHash)
    fromData.append('chunkFilename', fileName)
    fromData.append('chunkIndex', chunkIndex.toString())
    fromData.append('chunkBlob', chunkBlob)
    collectController(chunk, false)
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
        /**
         * 为什么要重新获取？不适用外面的变量 uploadedTotal, totalChunks
         * */
        //  const { uploadedTotal, totalChunks } = fileList.value[fileInfoIndex]
        //  const currentUploadedTotal = uploadedTotal + 1
        // fileList.value[fileInfoIndex].uploadedTotal = currentUploadedTotal
        // updateFileProgress(fileInfoIndex, currentUploadedTotal, totalChunks)
        // updateFileSeedCallBack(fileId, CHUNK_SIZE, fileInfoIndex)

        fileList.value[fileInfoIndex].uploadedTotal =
          fileList.value[fileInfoIndex].uploadedTotal + 1
        const { uploadedTotal, totalChunks } = fileList.value[fileInfoIndex]
        collectController(chunk, true)

        updateFileProgress(fileInfoIndex, uploadedTotal, totalChunks)
        updateFileSeedCallBack(fileId, CHUNK_SIZE, fileInfoIndex)

        if (uploadedTotal === totalChunks) {
          await mergeChunks(fileName, fileId)
        }

        return { fileId, done: true, chunkHash }
      }
    } catch (error) {
      return { fileId, done: false, chunkHash }
    }
  }
  /***
   *
   * 一：开始某一个文件上传：
   * 二：开始新的文件上传：
   * 1. 有pending状态的文件就继续处理下一个文件
   * 2. 没有pending状态的文件表示处理完了。把剩余的线程、请求数分配
   * */
  const continueUpload = async (fileInfoIndex?: number) => {
    if (typeof fileInfoIndex === 'number') {
      await uploadFileMiddle(fileInfoIndex)
    } else {
      const getFileList = fileList.value.filter(v => v.status === 'pending')
      if (getFileList.length) {
        const { id: fileId } = getFileList[0]
        const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
        await uploadFileMiddle(fileInfoIndex)
      }
    }
    // 分配剩余的线程
    assignWorkerFile()
    // 分配剩余的请求
    assignFileRequest()
  }

  const { processQueue, assignFileRequest, cancleRequest, activeConfig } = useRequestQueue(
    uploadCunkPool,
    fileList,
    uploadChunk,
    continueUpload,
    updateFileSeed,
    getData
  )

  const uploadFile = async (event: Event): Promise<any> => {
    const input = event.target as HTMLInputElement
    const files = input.files
    if (files && files.length > 0) {
      const data: fileInfoType[] = Array.from(files).map((file, index) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
        return {
          id: file.name + index,
          file,
          bindworkerIndex: [],
          status: 'pending',
          progress: 0,
          seed: '0 B',
          totalChunks,
          uploadedTotal: 0,
        }
      })
      fileList.value = data

      // 开始上传:至少有一个线程处理一个文件
      const count = data.length >= uploadNumber.value ? uploadNumber.value : data.length

      for (let index = 0; index < count; index++) {
        await uploadFileMiddle(index)
      }
      // 分配剩余的线程
      assignWorkerFile()
      // 分配剩余的请求
      assignFileRequest()
    }
  }
  /***
   * 给worker分配处理文件片任务
   * 1. uploadNumber个文件，每个文件分配一个线程, 线程不够分就调整uploadNumber
   * 开始上传:至少有一个线程处理一个文件；合并完成后开始处理下一个文件
   * 2. 分配剩余的线程：
   * 规则：优先分配给size大的文件
   * 3. 文件合并完成后，分配给其它文件
   * */
  const assignWorkerFile = (fileId?: fileIdType, workerIndex?: number) => {
    console.log('assignWorkerFile')

    if (workerIndex == -1) {
      console.log('没有线程了')
      return
    } else if (typeof workerIndex === 'number' && fileId) {
      // 给worker分配处理文件片任务
      workers.value[workerIndex].isBusy = true
      workers.value[workerIndex].handleFile = fileId

      manageFileBindworkerIndex({
        type: 'add',
        fileList,
        workerIndex,
        fileId,
      })
      // 执行任务
      assignTaskToWorker(workerIndex)
    } else {
      /***
       * 分配剩余的线程：
       * 1. 是否有多余的线程：没有就不分配
       * 2. 有：分配给正在上传的文件
       * */
      if (Object.keys(fileTaskPool.value).length === 0) {
        console.log('没有任务分配')
        return
      }
      for (let index = 0; index < workers.value.length; index++) {
        if (workers.value[index].isBusy) continue
        const pendingFile = fileList.value.filter(v => v.status === 'uploading')
        const sortData = pendingFile.sort((a, b) => b.file.size - a.file.size)
        if (sortData.length === 0) {
          console.log('没有正在上传的文件')
          break
        }
        const { id: fileId, totalChunks } = sortData[0]
        // fileTaskPoolItem 不存在说明hash计算完了
        const fileTaskPoolItem = fileTaskPool.value[fileId]
        if (sortData.length && fileTaskPoolItem && fileTaskPoolItem.length) {
          const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
          workers.value[index].isBusy = true
          workers.value[index].handleFile = fileId
          fileList.value[fileInfoIndex].status = 'uploading'
          manageFileBindworkerIndex({
            type: 'add',
            fileList,
            workerIndex: index,
            fileId,
          })

          assignTaskToWorker(index)
        } else {
          // 这次上传完的文件处理完了：其它的文件在merge成功后会重新分配
          break
        }
      }
    }
  }
  /***
   * 为文件创建任务池：
   * 1. 已经上传一部分
   * 2. 文件被暂停过/文件已经创建过任务池：创建了一部分 （防止后面要边创建任务池->hash计算->上传）
   * 3. 没有创建过
   * */
  const createFileTaskPool = (
    file: File,
    fileId: string,
    totalChunks: number,
    uploadedChunks: string[]
  ) => {
    const chunk: taskChunkType[] = []
    const size = file.size
    const doneTask = []
    // 已经完成的任务
    if (fileTaskPool.value[fileId]) {
      const task = fileTaskPool.value[fileId].map(v => v.chunkIndex)
      // console.log('fileTaskPool', task)
      doneTask.push(...task)
    }
    if (uploadCunkPool.value[fileId]) {
      const task = uploadCunkPool.value[fileId].map(v => v.chunkIndex)
      // console.log('uploadCunkPool', task)
      doneTask.push(...task)
    }
    // console.log('doneTask', doneTask)
    // console.log('uploadedChunks', uploadedChunks)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (uploadedChunks.includes(String(chunkIndex)) || doneTask.includes(chunkIndex)) {
        continue
      }

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
    // console.log('chunk', chunk)
    // debugger
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
    console.log('assignTaskToWorker')
    const { isBusy, handleFile: fileId, worker } = workers.value[workerindex]

    if (isBusy && fileId) {
      const task = fileTaskPool.value[fileId]

      if (task && task?.length) {
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
          processQueue()
          handleStatusUploadingFile(workerindex)
          assignTaskToWorker(workerindex)
          // uploadChunk(id)
          // await callBack(chunk, totalChunks, upLoadedChunks)
        }
      } else {
        // 更新当前worker的状态
        if (fileTaskPool.value[fileId]) delete fileTaskPool.value[fileId]
        if (workers.value[workerindex].handleFile) workers.value[workerindex].handleFile = undefined
        if (workers.value[workerindex].isBusy) workers.value[workerindex].isBusy = false
        manageFileBindworkerIndex({
          type: 'add',
          fileList,
          workerIndex: workerindex,
          fileId,
        })
        assignTaskToWorker(workerindex)
      }
    } else {
      // 当前worker空闲，分配其它文件
      console.log('当前worker空闲，分配其它文件')
      assignWorkerFile()
    }
  }

  // 合并切片文件
  const mergeChunks = async (fileName: string, fileId: string) => {
    const response = await fetch('/api/file/merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: fileName }),
    })
    if (response.ok) {
      const fileInfoIndex = fileList.value.findIndex(v => v.id === fileId)
      fileList.value[fileInfoIndex].status = 'completed'
      // 清除数据
      if (uploadCunkPool.value[fileId]?.length === 0) delete uploadCunkPool.value[fileId]
      if (activeConfig.value[fileId]?.pending === 0) delete activeConfig.value[fileId]
      // 继续传
      continueUpload()

      ElMessage({
        message: '上传成功',
        type: 'success',
      })
    }
  }

  /**
   * 暂停：
   * 1. 取消这个文件的上传接口：cancleRequest
   * 2. 修改这个文件的状态：paused
   * 3. 取消请求分配
   * 4. 取消worker分配
   * 5. 开始下一个的文件上传：continueUpload
   * */
  const onPaused = (info: fileInfoType, fileIndex: number, isContinue = true) => {
    const { id } = info
    cancleRequest(id)
    fileList.value[fileIndex].status = 'paused'

    // 解除 worker 分配
    for (let workerindex = 0; workerindex < workers.value.length; workerindex++) {
      const { isBusy, handleFile } = workers.value[workerindex]
      if (isBusy && handleFile === id) {
        workers.value[workerindex].isBusy = false
        workers.value[workerindex].handleFile = undefined
      }
    }
    // 解除 文件绑定的worker
    manageFileBindworkerIndex({
      type: 'delete',
      fileList,
      fileId: id,
    })
    if (isContinue) {
      continueUpload()
    }
  }
  /**
   * 重新开始上传：
   * 1.  uploadNumber ==  fileList.length(uploading) :修改这个文件的状态为pending，等待上传
   * 2.  uploadNumber >  fileList.length(uploading): 马上传这个文件
   * 为文件创建任务池：已经创建过/未创建
   * 请求分配：有多余的请求(assignFileRequest)/没有多余的请求；
   * worker分配：有空闲的线程(assignWorkerFile)/没有空闲的线程；
   *   有就分一个，没有多余的请求/没有空闲的线程：先设置为uploading,bindworkerIndex =[]，然后在hash计算/上传切片异步结束后，
   * 找出分配最多的，至少分配给一个线程/请求并发给这个文件
   * */
  const onContinueUpload = async (info: fileInfoType, index: number) => {
    const uploadingFile = fileList.value.filter(v => v.status == 'uploading')
    if (uploadingFile.length === uploadNumber.value) {
      fileList.value[index].status = 'pending'
    } else if (uploadNumber.value > uploadingFile.length) {
      // debugger
      /**
       * 1. 只剩暂停的这一个文件。开始的时候马上暂停（worker没工作完了）/上传了一部分（worker工作完了）
       * 2. 同时上传2个：有一个正在传，然后传这个暂停的文件：开始的时候马上暂停/上传了一部分
       * */
      fileList.value[index].status = 'uploading'
      fileList.value[index].uniqueStatus = 'once'

      await continueUpload(index)
      // 开始请求
      await processQueue()
    }
  }
  /**
   * 能上传数:pending+uploading
   * number：变化后的number
   * 1. number（大->小）: 请求个数>number 的请求，全部暂停
   * 2. number（小->大）： 发起的 请求个数== number；不够就立即发起
   * */
  const changeUploadNumber = (number: number, oldNumber: number) => {
    const uploadingFile = fileList.value.filter(v => v.status === 'uploading')

    //  1.大->小
    if (number < oldNumber) {
      let num = 0
      // 上传的个数只能为number个
      fileList.value.forEach((v, index) => {
        if (v.status === 'uploading') {
          num = num + 1
          if (num > number) {
            onPaused(v, index, false)
          }
        }
      })
    }
    // 2.小->大
    if (number > oldNumber) {
      let num = number - uploadingFile.length
      fileList.value.forEach((v, index) => {
        if (num <= 0) {
          return
        }
        if (v.status === 'pending') {
          num = num - 1
          onContinueUpload(v, index)
        }
      })
    }
  }

  /**
   * 最后开始上传暂停的文件: 特殊情况：worker全部被占用； 需要重新分配
   * 基本条件：
   * 1. 有uniqueStatus === 'once'标识的文件
   * 2. worker全部被占用
   *  下才能执行
   *
   * */
  const handleStatusUploadingFile = (workerindex: number) => {
    // 占用的文件
    let maxWorkerFile: any = null
    // 正要上传的文件
    let targetFile = null
    fileList.value.forEach(v => {
      if (v.status == 'uploading' && v.uniqueStatus === 'once') {
        targetFile = v
      }
      if (v.status === 'uploading' && v.uniqueStatus != 'once') {
        if (!maxWorkerFile) {
          maxWorkerFile = v
        } else {
          if (maxWorkerFile.bindworkerIndex.length > v.bindworkerIndex.length) {
            maxWorkerFile = { ...v }
          }
        }
      }
    })
    const workindex = findIdleWork()
    console.log('targetFile--->', targetFile)

    /***
     * 1.
     * */
    if (!targetFile) {
      return
    }
    /***
     * 2. 有多余的线程
     * */
    if (workindex != -1) {
      // getData()
      // console.log('maxWorkerFile', maxWorkerFile)
      // console.log('workerindex', workerindex)
      // console.log('targetFile', targetFile)
      // debugger
      assignWorkerFile()
      return
    }

    // getData()
    // console.log('maxWorkerFile', maxWorkerFile)
    // console.log('workerindex', workerindex)
    // console.log('targetFile', targetFile)
    // debugger
    if (maxWorkerFile && maxWorkerFile.bindworkerIndex.includes(workerindex)) {
      const { id: targetId } = targetFile
      // 重新设置worker线程
      workers.value[workerindex].isBusy = true
      workers.value[workerindex].handleFile = targetId
      manageFileBindworkerIndex({
        type: 'add',
        workerIndex: workerindex,
        fileId: targetId,
        fileList,
      })
      manageFileBindworkerIndex({
        type: 'update',
        workerIndex: workerindex,
        fileId: maxWorkerFile.id,
        fileList,
      })

      // getData()
      // debugger
    }
  }
  // 文件上传中间函数
  const uploadFileMiddle = async (index: number) => {
    const { file, id, totalChunks } = fileList.value[index]
    const { data: uploadedChunks } = await getUploadedChunks(file.name)
    const number = uploadedChunks.length
    // 合并文件
    if (number == totalChunks) {
      mergeChunks(file.name, id)
      // continuereturn
    }
    fileList.value[index].uploadedTotal = uploadedChunks.length

    createFileTaskPool(file, id, totalChunks, uploadedChunks)
    assignFileRequest(id)
    const workIndex = findIdleWork()
    assignWorkerFile(id, workIndex)
  }

  const findIdleWork = () => {
    const workIndex = workers.value.findIndex(v => v.isBusy === false && !v.handleFile)
    return workIndex
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
    .box {
      width: 500px;
    }
  }
  .progress {
    display: flex;
    align-items: center;
    .seed {
      margin-right: 12px;
    }
  }
  .el-progress--line {
    margin-right: 6px;
    width: 600px;
  }
</style>
