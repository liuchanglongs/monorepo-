import SparkMD5 from 'spark-md5'
import type { chunkType, taskChunkType } from '../type'

//  每个worker对应一个文件块
//  这里的worker是一个独立的线程，不能直接访问DOM
onmessage = async e => {
  const info: taskChunkType = e.data
  const chunk = await createChunk(info)
  postMessage({ ...chunk })
  // let doneChunk = 0
  // const allChunk = end - start

  // //   这里进行每个文件块的文件切片
  // for (let index = start; index < end; index++) {
  //   if (uploadedChunksIndex.includes(index.toString())) {
  //     // 如果已经上传过了，就不需要再处理了
  //     doneChunk++
  //     postMessage({
  //       chunkIndex: index,
  //       uploaded: true,
  //       isDoneThread: doneChunk == allChunk ? true : false,
  //     })
  //     continue
  //   }
  //   const chunk = await createChunk(file, index, chunkSize)
  //   doneChunk++
  //   postMessage({ ...chunk, isDoneThread: doneChunk == allChunk ? true : false })
  // }
}

// 切片处理
const createChunk = (info: taskChunkType): Promise<chunkType> => {
  return new Promise((resolve, reject) => {
    const { chunkBlob, ...ohter } = info
    /**
     * 创建用于处理二进制数据（如文件）的实例
     * append(data)：添加数据（分块时逐次调用）
     * end()：完成计算并返回最终的 MD5 哈希值（32 位小写字符串）
     * */
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()
    if (!chunkBlob) {
      reject(new Error('chunkBlob is undefined'))
      return
    }
    fileReader.readAsArrayBuffer(chunkBlob)
    fileReader.onerror = err => {
      console.log('fileReader', err)
      reject('fileReader.onerror ')
    }
    // 处理每块数据: 异步读取文件内容
    fileReader.onload = e => {
      const result: any = e.target?.result
      if (!result) return
      spark.append(result) // 添加分块数据
      const md5 = spark.end()
      resolve({
        ...ohter,
        chunkHash: md5,
        uploaded: false,
      })
    }
  })
}
