import SparkMD5 from 'spark-md5'

export interface chunkType {
  // 开始的size
  chunkStart?: number
  // 结束的size
  chunkEnd?: number
  // 第几个切片
  chunkIndex: number
  chunkHash?: string
  chunkBlob?: Blob
  uploaded: boolean // 是否上传过
}

//  每个worker对应一个文件块
//  这里的worker是一个独立的线程，不能直接访问DOM
onmessage = async e => {
  const { file, end, start, chunkSize, uploadedChunks } = e.data
  // console.log('Worker index:', end, start, chunkSize)

  //   这里进行每个文件块的文件切片
  const result = []
  for (let index = start; index < end; index++) {
    if (uploadedChunks.includes(index.toString())) {
      // 如果已经上传过了，就不需要再处理了
      result.push(
        Promise.resolve({
          chunkIndex: index,
          uploaded: true,
        })
      )
      continue
    }
    result.push(createChunk(file, index, chunkSize))
  }
  console.log('fetch', fetch)

  const chunks: chunkType[] = await Promise.all(result)
  postMessage(chunks)
}

// 切片处理
const createChunk = (file: File, index: number, chunkSize: number): Promise<chunkType> => {
  return new Promise((resolve, reject) => {
    const start = index * chunkSize
    const end = start + chunkSize
    const blob = file.slice(start, end)
    /**
     * 创建用于处理二进制数据（如文件）的实例
     * append(data)：添加数据（分块时逐次调用）
     * end()：完成计算并返回最终的 MD5 哈希值（32 位小写字符串）
     * */
    const spark = new SparkMD5.ArrayBuffer()
    const fileReader = new FileReader()
    fileReader.readAsArrayBuffer(blob)
    fileReader.onerror = err => {
      console.log('fileReader', err)
      reject
    }
    // 处理每块数据: 异步读取文件内容
    fileReader.onload = e => {
      const result: any = e.target?.result
      if (!result) return
      spark.append(result) // 添加分块数据
      const md5 = spark.end()
      resolve({
        // 开始的size
        chunkStart: start,
        // 结束的size
        chunkEnd: end,
        // 第几个切片
        chunkIndex: index,
        chunkHash: md5,
        chunkBlob: blob,
        uploaded: false, // 是否上传过
      })
    }
  })
}
