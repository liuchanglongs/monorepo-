# 1. 文件系统 API

- 链接：https://developer.mozilla.org/zh-CN/docs/Web/API/File_System_API
  &emsp;&emsp;文件系统 API（File System API）——以及通过文件系统访问 API（File System Access API）提供的扩展来访问设备文件系统中的文件——允许使用文件读写以及文件管理功能。任何通过写入流造成的更改在写入流被关闭前都不会反映到文件句柄所代表的文件上。这通常是将数据`写入到一个临时文件`来实现的，然后只有在写入`文件流被关闭后`才会用`临时文件替换掉文件句柄所代表的文件`。
- 关键API的使用：

```js
// 选择保存目录
const dirHandle = await window.showDirectoryPicker({
  mode: 'readwrite',
  startIn: 'downloads',
})

// 创建文件句柄:方法返回一个位于调用此方法的目录句柄内带有指定名称的文件的 FileSystemFileHandle
fileHandle = await dirHandle.getFileHandle(fileName, { create: true })

// 创建可写流 - 重新创建文件，确保文件是空的
writable = await fileHandle.createWritable()
// 写入数据到临时文件上的当前指针偏移处写入内容(没有设置从0开始)，有内容就覆盖内容
await writable.write(value)

/**
 * 暂停后续下载：
 * */
const existingFile = await fileHandle.getFile()
const existingArrayBuffer = await existingFile.arrayBuffer()
const position = existingArrayBuffer.byteLength || 0
// 1.
// 设置指针位置
await writable.write({ type: 'seek', position })
await writable.write(test)

// 2.先写入现有数据，在写入传入的流
if (existingArrayBuffer.byteLength > 0) {
  await writable.write(existingArrayBuffer)
}
await writable.write(test)
```
