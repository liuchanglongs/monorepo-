# 1.大文件上传

## 1.参考资料

- 文件上传案例( 没看)：
  ● https://github.com/shengxinjing/upload
  ● https://github.com/yeyan1996/file-upload
- webwork的知识：
  ● https://blog.csdn.net/liangshanbo1215/article/details/146421348
  ● https://web.dev/articles/off-main-thread?hl=zh-cn
  ● https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API

## 2.为啥使用web worker

&emsp;&emsp;总结：前端文件上传，最主要的消耗时间就是在把文件进行**hash转换的过程中**。

1. 不使用 Web Worker 的潜在问题

- 超大切片在计算hash转换会引起页面卡顿（切片大小增加到 50MB 以上）；比如输入框输入会卡顿；例如：在计算 hash 的同时滚动页面，可能出现滚动不流畅、延迟响应的现象。
- 整个文件/所有切片计算hash时，文件越大越慢。
- 占用主线程：hash 计算会与这些操作争夺主线程资源，导致整体性能下降。

2. Web Worker 的核心价值：稳定性与效率

- Web Worker 中的 hash 计算在独立线程执行，无论计算耗时多长，都不会占用主线程资源，确保 UI 始终流畅响应。
- Web Worker 可以将多个切片的 hash 计算分配到不同线程，并行处理，从而缩短总计算时间（尤其对超大文件优势明显）。

## 3.在框架中使用web worker的注意事项

&emsp;&emsp;总结：要保证worker.js/ts/jsx/tsx脚本要被编译(webpack/vite使用对应的loader)成浏览器可以识别的js资源；注意路径问题，可以在浏览器的请求url中验证。

1.  Webpack 5+ 原生支持（推荐）
    ![alt text](src/img/3.png)
2.  Webpack 4 及以下（需使用 worker-loader）
    ![alt text](src/img/1.png)![alt text](src/img/4.png)
3.  vite中（最新、这个使用过）

```js
const worker = new Worker(new URL('./utils/worker.ts', import.meta.url), { type: 'module' })
```

## 2. 文件上传逻辑梳理

### 2.1一些理解（重要）

1. 非阻塞上传：切一片就上传，减少用户等待的时间。
2. 切片：文件file有一个slice可以根据size进行切片。、唯一id、cpu的线程数
3. 唯一id（根据每一个文件的内容计算md5/hash）：后端拿到切片文件，对切片文件在进行md5计算，对比与前端的是否一样。防止在传输过程中被损坏。非常消耗内存，阻塞浏览器代码执行
4. 浏览器cpu的线程数：navigator.hardwareConcurrency 是一个浏览器 API 属性，用于返回当前设备的逻辑处理器核心数量（即 CPU 线程数）。这个值通常与设备的核心数相关，可用于优化多线程任务（如 Web Worker）的分配策略。
5. 接口并发的数量控制：浏览器对请求的并发是有限制的，多余这个限制会排队pending等待，我们一般设置1-3.一般后端会处理，对切片上传的接口并发数量进行控制，当前端直接切完文件就上传就会导致一下发起很多的请求，都处于pending的状态，很容易请求超时，所以前端也要做并发的控制。
6. 秒传：就是同一个文件上传的的切片不用再传。
7. 实际产品怎么区别是否是同一个文件/一个文件的独一无二的id：常用的做法是选取文件的前30M的内容，来对这30M的内容、文件大小做文件hash，结合文件用户的登录信息，比如用户名、用户id一起作为临时文件的存储路径，防止同名的问题。
8. 切片计算完就上传：减少用户等待的白屏，页面进度条反馈变快;缺点大量的切片接口被发起。

### 2.2 逻辑梳理

1. 切片大小CHUNK_SIZE、启用的线程个数THREAD_COUNT
2. 获取上传的切片（切片的索引uploadedChunks）

- 目的上传的切片就不要传了、前端不做hash处理了。利用切片数量范伟生成的索引来判断。
- 要区别是否是同一个文件。

3. 计算切片数量totalChunks、计算并发上传数量；每个线程需要处理切片数量concurrentUploads

- 注意：向上取整

4. 根据THREAD_COUNT，计算出每个线程处理的切片范围，并启动webWork。

- 分配到最后一段，不能操作totalChunks
- 避免文件过小，开启空线程：

```js
if (totalChunks < end) {
  end = totalChunks
}
// 避免文件过小，开启空线程
if (start >= end) {
  return
}
```

2. 计算每个线程需要的切片数量
3. 计算每个线程在切片列表中start、end的位置
4. 每个线程启用一个web worker ->传递给worker数据、接收worker返回的数据、捕获worker错误
5. 每个线程进行切片：拿到当前的切片文件->读取文件->计算hash->返回参数->将所有的数据传(postMessage)给主线程
6. web worker中：

- 如果已经上传过了，就不需要再处理了
- 切片、hash处理

7. worker.onmessage开始上传切片、处理完切片就关闭当前web work

- 何时上传：切片返回的数据uploaded控制。已经上传设置为true

```js
{
  // 开始的size
  chunkStart: start,
  // 结束的size
  chunkEnd: end,
  // 第几个切片
  chunkIndex: index,
  chunkHash: md5,
  chunkBlob: blob,
  uploaded: false, // 是否上传过，
  isDoneThread:false // 当前线程是否工作完
}
```

- 何时关闭线程：完成的个数等与处理完个数时，isDoneThread为true,最后一个上传完就关闭

8. 合并文件：切片全部上传时调用合并（上传完成一个切片、已经上传过的切片的数量 === totalChunks）

- 第一种情况：最后一个切片上传，开始合并。
- 第二种情况: 最后一个切片上传，开始合并出错，重新上传、重试时，开始合并
- **注意**：不能用开启的线程数 === 关闭的线程数 ，来请求merge合并文件。线程走完了，不代表文件切片上传完了

9. 切片上传接口的并发数量的控制：useRequestQueue

- 等待队列queue、当前正在执行的请求数量activeCount
- 执行队列中的下一个请求、添加请求到队列addRequest、清空队列clearQueue

# 还没有实现 2. 进度条、暂停 3. 上传了一部分，下次上传，这部分秒传

# 3. 后端搭建

## 1. 环境

```js
  "dependencies": {
    "busboy": "^1.6.0",
    // "cors": "^2.8.5",
    "express": "^5.1.0",
    // "multer": "^2.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.10"
  }
```

## 2. 一些理解

1. 获取已经上传的文件: 切片索引来匹配是否合理.

- 只要要有一个字段（一个文件的独一无二的id）能区分是否为同一个文件就行。

## 3. 逻辑梳理

1. 上传切片接口实现：

- 开始创建一个目录存放文件upload
- 在这个目录下创建一个临时的存放这些切片的目录：`${chunkFilename}_CHUNKS`
- 这个临时目录写入切片：`chunk_${chunkIndex}`

2. 合并文件：将临时目录文件下的切片，合成一个文件，并重命名，存放在upload下

- 1. 为啥重命名：防止与临时文件、目录与其它上传的文件名重复：一般重命名为name(1).mvp/`name(index++)`
- 2. **注意**：用户中断请求（在上传切片的时候刷新浏览器），有冗余的文件：一、文件正在上传，然后突然刷新、网络中断。重新上传，可能会合并失败。原因是可能后端在接收文件写在临时的目录中，切片文件没有写入完，请求就中断了。如果请求中断的时候不删除该文件，会导致合并的文件，出现破损，无法打开。二、有写入完（文件写入流没有结束），close方法不会调用，文件为占用状态，删除文件就会报错。

```js
req.on('aborted', () => {
  console.log('请求被客户端中断开始chunkPath:', chunkPath)
  console.log('请求被客户端中断开始writeStream:', writeStream)
  // 关闭未完成的写入流，避免文件残留
  if (writeStream && chunkPath) {
    writeStream.destroy()
    fsPromises
      .unlink(chunkPath)
      .then(res => {
        console.log('删除中断的分片res:', res)
      })
      .catch(err => {
        console.log('删除中断的分片err:', err)
      })
  }
})
```

- 3. 操作系统的原因：文件夹非空，不能直接删除文件夹，要递归删除文件，才能删除文件夹。
     ![alt text](src/img/5.png)
- 4. 前端切片上传：假如600个，中间断断续续出现CONNECTION_TIME_OUT,接口没打到后端：原因在multer写入文件的时候占满了文件缓存区
- 合并接口失败：
  ![alt text](src/img/6.png)
  ![alt text](image.png)
  ![alt text](image-1.png)
  ![alt text](image-2.png)
  &emsp;&emsp;Node.js 的 WriteStream 内部有一个缓冲区（内存中的临时存储区域）：当调用 writeStream.write(chunk) 时，数据会先进入缓冲区；缓冲区中的数据会被异步地写入磁盘（由 Node.js 底层处理）；如果缓冲区已满（比如写入速度超过磁盘处理速度），write() 方法会返回 false，表示暂时无法接受新数据。
  &emsp;&emsp;**解决**：流缓冲区满时，不写入文件，等待drain事件触发，再继续写入

```js
for (let index = 0; index < chunkFileNames.length; index++) {
  const sort = chunkFileNames[index]
  const chunkPath = path.join(chunksDir, CHUNKNAME_FN(sort))
  const chunk = await fsPromises.readFile(chunkPath)
  const isWrite = writeStream.write(chunk)
  if (!isWrite) {
    console.log('写入流缓冲区满时：isWrite:', isWrite)
    // 写入流缓冲区满时，等待drain事件
    await new Promise(resolve => writeStream.once('drain', resolve))
  }
}
```
