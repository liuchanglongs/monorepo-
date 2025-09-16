<template>
  <div>
    <el-button @click="showOpenFilePicker">选择文件</el-button>
    <el-button @click="showDirectoryPicker">选择目录</el-button>
    <el-button @click="saveFile">saveFile</el-button>
    <el-button @click="continueSaveFile">continueSaveFile</el-button>
    <el-button @click="handle(true)" :disabled="paused">暂停</el-button>
    <el-button @click="handle(false)" :disabled="!paused">继续</el-button>
  </div>
</template>
<script setup lang="ts">
  import { ref } from 'vue'

  const CHUNK_SIZE = 1024 * 1024 // 1MB 每片
  const TOTAL_CHUNKS = 10 // 总片数，模拟一个10MB的文件
  //   true 为暂停
  const paused = ref(false)
  const uploadNumber = ref<number>(2)
  const showOpenFilePicker = async () => {
    //     if (window.showOpenFilePicker) {
    //     //   const FileSystemFileHandle = await window.showOpenFilePicker()
    //     //   const file = await FileSystemFileHandle[0].getFile()
    //    // 创建层级结构的文件和文件夹
    //     } else {
    //       console.error('showOpenFilePicker is not supported in this browser.')
    //     }

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
        startIn: 'downloads', // 可选：默认从“下载”目录开始
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
    // 创建一个指定大小的二进制数据块
    // const buffer = new ArrayBuffer(CHUNK_SIZE)
    // const view = new Uint8Array(buffer)

    // // 填充一些示例数据
    // for (let i = 0; i < view.length; i++) {
    //   // 简单的模式，方便验证数据连续性
    //   view[i] = (chunkIndex + i) % 256
    // }
    // 写入图片
    // return new Blob([imageBuffer], { type: 'image/png' });

    // // 写入 PDF
    // return new Blob([pdfBuffer], { type: 'application/pdf' });

    // // 写入文本文件（需确保数据是字符串编码）
    // return new Blob([textContent], { type: 'text/plain; charset=utf-8' });
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
