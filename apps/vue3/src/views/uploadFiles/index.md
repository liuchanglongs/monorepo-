# 多个文件同时上传

&emsp;&emsp;文件的上传逻辑跟单个大文件上传的逻辑一样。主要难点逻辑不同体现在：

- 问题一：同时上传个数、启动的 web worker 数量 、 批量请求限制它们之间的个数如何衡量、设计？
- 问题二：web worker 如何分配给`同时上传的几个文件`，完成 hash 转换？
- 问题三：如何实现`同时上传的几个文件`的请求并发控制？

```
这3个问题的解决方式是：实现任务队列管理和优先级机制：
- 任务生产者：负责拆分文件：读取待上传文件列表，将每个文件拆分为 “数据块子任务”，加入共享任务队列。

- 共享任务队列：每个文件都有自己的， “分块 Hash 计算子任务”，支持线程安全的 “取任务”（避免并发竞争）。

- 线程池: 管理固定数量的工作线程（如 3 个，匹配 “同时上传 3 个文件” 的需求），线程空闲时从队列取任务。

```

## 问题一：

&emsp;&emsp;一般上传个数 <= 批量请求限制 <= web worker数量；百度网盘与阿里云盘设计的是只能同时上传3个
最好的情况就是 上传数 === web worker数量
&emsp;&emsp;线程数：可以通过读取 navigator.hardwareConcurrency 作为上限参考；**_原则一个web worker至少对应一个请求一个上传的文件，让同时上传的文件都能上传_**。一般为3个，根据设备性能设置上限，通常不超过8个。

## 问题二：

&emsp;&emsp;实现线程、文件列表、文件切片任务池、的队列管理；

### 1. 文件列表

&emsp;&emsp;主要进行态管理，维护每个文件的切片的上传状态及一些全局数据

```ts
export interface fileInfoType {
  id: fileIdType
  file: File
  // pending:准备状态；uploading：上传状态
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error'
  progress: number
  seed: number | string
  // 是否绑定了worker: 方便寻找线程
  bindworkerIndex: any[]
  /**
   * 特殊情况：
   * once: 代表解决暂停后上传的特殊情况：uploadingFile.length != uploadNumber.value
   * */
  uniqueStatus?: 'once'
  // 已经上传切片的数量
  uploadedTotal: number
  // 总切片数
  totalChunks: number
}
```

### 2. 线程队列

&emsp;&emsp;如果上传个数 > web worker数量,那么handleFile可以设计为fileIdType[]

```ts
export type fileIdType = string
export interface workersType {
  worker: Worker
  // 是否在工作
  isBusy: Boolean
  //  当前处理的文件列表
  handleFile?: fileIdType
}
const workers = ref<workersType[]>([])
```

### 3. 文件切片任务池的队列:

&emsp;&emsp;通过线程队列，生成上传切片任务池服务
&emsp;&emsp;每个文件都有自己的切片任务池的队列， “分块 Hash 计算子任务”时候，分配的线程就会从各自的队列中去取，支持线程安全的 “取任务”（避免并发竞争）。

```ts
export interface comChunkType {
  // 开始的size
  chunkStart: number
  // 结束的size
  chunkEnd: number
  // 第几个切片
  chunkIndex: number
}
export interface taskChunkType extends comChunkType {
  chunkBlob?: Blob
}
// 文件切片任务池
const fileTaskPool = ref<{ [id: string]: taskChunkType[] }>({})
```

### 4. web worker分配调度

- 分配 webworker, 先保证每个任务先分配一个worker
- 空余的webworker分配给正在计算最大size的hash文件
- 优先级机制：可以通过size、类型计算一个分数，总和不超过1.多余的web work分给它`（没做）`
- 具体逻辑 看`assignWorkerFile`函数

```ts
fileInfoType中多加个类型就行
```

## 问题三：

### 1. 上传切片任务池：

&emsp;&emsp;每个上传文件生成的hash chunk 列表

```ts
export interface chunkType extends comChunkType {
  chunkHash: string
  uploaded: boolean // 是否上传过
}

// 上传切片任务池
const uploadCunkPool = ref<{ [id: string]: chunkType[] }>({})
```

### 2. 并发控制:

&emsp;&emsp;所有分配的请求并发限制个数 <= 总限制个数

```ts
// 正在上传的文件请求数量的分配
const activeConfig = ref<{ [key: string]: { total: number; pending: number } }>({})
```

### 3. 并发控制机制

- 先保证每一个上传的文件要有一个请求
- 动态调整分配剩余请求：如果当前总活跃请求数小于最大并发数，则为最大的文件分配请求
- 具体逻辑 看`assignFileRequest`函数

### 4. 请求逻辑：

&emsp;&emsp;看 ./utils/useRequestQueue.ts中的processQueue函数

# 功能

&emsp;&emsp;功能实现顺序：单个上传 -> 多个同时上传 -> 某一个传完继续下一个文件上传 -> 暂停 -> 开始（暂停的文件）-> 控制同时上传的个数

## 暂停

&emsp;&emsp; 看这个 onPaused 函数

## 开始（暂停的文件）

&emsp;&emsp; 看这个 onContinueUpload 函数

```
解决暂停后上传的特殊情况：uploadingFile.length != uploadNumber.value
index.vue/ handleStatusUploadingFile 函数
utils/useRequestQueue.ts  handleStatusUploadingFile 函数
```

## 控制同时上传的个数

&emsp;&emsp; 看这个 changeUploadNumber 函数 5. 暂停 / 恢复功能：

# 解决内存消耗的问题：

- 切片的chunk有必要传回Blob？避免双倍的内存开销
