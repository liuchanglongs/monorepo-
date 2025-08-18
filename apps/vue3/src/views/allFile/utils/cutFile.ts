import type { chunkType } from './worker'

/**
 * 每个线程对应一个文件块;
 * 异步处理完返回所有文件块的切片数据
 * */
export const cutFile = (
  file: File,
  CHUNK_SIZE: number,
  THREAD_COUNT: number,
  uploadedChunks: string[]
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const result: chunkType[] = []
    let doneThreadCount = 0
    // 切片数量
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    // 计算并发上传数量；每个线程需要的切片数量
    const concurrentUploads = Math.ceil(totalChunks / THREAD_COUNT)
    for (let index = 0; index < THREAD_COUNT; index++) {
      // 每个线程处理的切片范围start - end
      const start = index * concurrentUploads
      let end = start + concurrentUploads
      if (totalChunks < end) {
        end = totalChunks
      }
      // 创建一个新的Worker实例,一个Worker实例对应一个文件块
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      worker.postMessage({ file, start, end, chunkSize: CHUNK_SIZE, uploadedChunks })
      // 异步的
      worker.onmessage = e => {
        const chunks: chunkType[] = e.data
        chunks.forEach(chunk => {
          result[chunk.chunkIndex] = chunk
        })
        doneThreadCount++
        worker.terminate() // 终止当前worker线程
        // 所有线程都处理完了
        if (doneThreadCount === THREAD_COUNT) {
          //  返回数据
          resolve(result)
        }
      }
      worker.onerror = error => {
        console.error('Worker error:', error)
        reject(error)
      }
    }
  })
}
