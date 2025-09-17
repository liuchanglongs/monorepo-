const {
  getUniqueFilename,
  CHUNKDIRNAME_FN,
  CHUNKNAME_FN,
  removeDir,
} = require("../utils/flile");
const express = require("express");
const router = express.Router(); // 创建路由实例
const multer = require("multer");
const path = require("path");
// 回调函数嵌套风格
const fs = require("fs");
// 所有操作返回 Promise 对象，支持 then/catch 链式调用和 async/await 语法，更符合现代异步编程风格
const fsPromises = require("fs").promises;
const busboy = require("busboy");

/**
 * 通过 multer() 函数创建一个 upload 实例，配置项 { dest: "uploads/" } 指定了文件上传后的临时存储目录（项目根目录下的 uploads 文件夹）。
 * multer 是 Node.js 中处理 multipart/form-data 类型数据的中间件，专门用于接收文件上传（如图片、文档等），Express 本身不具备处理文件上传的能力，需要依赖此类中间件。
 * */
const upload = multer({
  dest: "/uploads/",
}); // 设置上传目录:项目的根路径
const UPLOAD_DIR = path.join(__dirname, "../uploads"); // 定义上传目录的绝对路径

/**
 * 上传切片:busboy做文件解析
 * @param {chunkBlob}  切片文件的 Blob 对象的字段名
 * */
router.post("/upload1", async (req, res) => {
  // 添加2秒延时
  await new Promise((resolve) => {
    const trim = setTimeout(() => {
      clearTimeout(trim);
      resolve();
    }, 3000);
  });
  const bb = busboy({ headers: req.headers });
  let chunkHash, chunkFilename, chunkIndex, writeStream;
  //  分片存储目录路径 、切片存储路径
  let chunkDir, chunkPath;
  // 异步
  bb.on("field", (name, val) => {
    if (name === "chunkHash") chunkHash = val;
    if (name === "chunkFilename") chunkFilename = val;
    if (name === "chunkIndex") chunkIndex = val;
  });

  // 以正常监听客户端请求中断事件的。
  req.on("aborted", () => {
    console.log("请求被客户端中断开始chunkPath:", chunkPath);
    console.log("请求被客户端中断开始writeStream:", writeStream);
    // 关闭未完成的写入流，避免文件残留
    if (writeStream && chunkPath) {
      writeStream.destroy();
      fsPromises
        .unlink(chunkPath)
        .then((res) => {
          console.log("删除中断的分片res:", res);
        })
        .catch((err) => {
          console.log("删除中断的分片err:", err);
        });
    }
  });
  bb.on("file", (name, file, info) => {
    //  分片存储目录路径
    chunkDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(chunkFilename));
    // 切片存储路径
    chunkPath = path.join(chunkDir, CHUNKNAME_FN(chunkIndex));

    fs.mkdir(chunkDir, { recursive: true }, (err) => {
      if (err) {
        return res
          .status(500)
          .json({ code: 500, message: "创建分片存储目录失败", error: err });
      }

      // 写入切片
      writeStream = fs.createWriteStream(chunkPath);
      // 将 file 这个可读流（Readable Stream）的数据 "管道" 到 writeStream 这个可写流（Writable Stream）中。
      file.pipe(writeStream);
      writeStream.on("close", () => {
        res.status(200).json({ code: 200, message: "分片存储成功" });
      });
      writeStream.on("error", (error) => {
        res.status(500).json({ code: 500, message: "分片存储失败" });
      });
    });
  });
  req.pipe(bb);
});
// multer做文件解析
router.post("/upload", upload.single("chunkBlob"), (req, res) => {
  const { chunkHash, chunkFilename, chunkIndex } = req.body;
  const chunk = req.file;
  console.log("chunk.path", chunk.path);

  //   创建分片存储目录
  const chunkDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(chunkFilename));
  if (!fs.existsSync(chunkDir)) {
    console.log("chunkDir", chunkDir);
    fs.mkdirSync(chunkDir);
  }
  const chunkPath = path.join(chunkDir, CHUNKNAME_FN(chunkIndex));
  //   /uploads中的文件移动到chunkPath目录
  fs.rename(chunk.path, chunkPath, (err) => {
    if (err) {
      res
        .status(500)
        .json({ code: 500, message: "分片存储失败", error: err.message });
    } else {
      // 现代版本的 multer 会自动处理临时文件的清理，无需手动删除
      // 理论上，fs.rename 移动文件后，原临时文件（chunk.path）会被自动删除，但在某些特殊场景下（比如跨分区移动文件），rename 可能会采用复制 + 删除的方式，此时原文件可能残留
      // fs.unlink(chunk.path) 是一道保险措施，确保临时文件被彻底删除，避免磁盘空间被无效的临时文件占用。
      fs.unlink(chunk.path, (err) => {
        // console.warn(`warn deleting file ${chunk.path}:`, err);
      });
      res.status(200).json({ code: 200, message: "分片上传成功" });
    }
  });
});
// 测试接口
router.get("/upload", (req, res) => {
  res.status(200).json({ code: 200, message: "分片上传成功" });
});

/**
 * 获取已经上传的切片
 * @param {string} fileName - 文件名
 * */
router.get("/get-uploaded-chunks", (req, res) => {
  let uploadedChunks = [];
  const chunksDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(req.query.fileName));
  //   console.log("fs.existsSync(UPLOAD_DIR):", fs.existsSync(UPLOAD_DIR));
  // 判断目录是否存在
  const isDirExists = fs.existsSync(chunksDir);
  if (isDirExists) {
    const files = fs.readdirSync(chunksDir);
    // console.log(files);
    uploadedChunks = files.map((file) => {
      return file.replace("chunk_", "");
    });
  }
  res
    .status(200)
    .json({ code: 200, message: "获取成功", data: uploadedChunks });
});

/**
 * 合并切片
 * @param {string} fileName - 文件名
 * */
router.post("/merge", async (req, res) => {
  const { fileName } = req.body;
  const chunksDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(fileName));
  if (!fs.existsSync(chunksDir)) {
    return res
      .status(404)
      .json({ code: 404, message: "分片目录不存在，合并失败" });
  }
  const chunkFileNames = fs
    .readdirSync(chunksDir)
    .map((name) => name.split("_")[1])
    .sort((a, b) => a - b);
  // 找目标文件名，然后重新起名字
  const uniqueFilename = getUniqueFilename(UPLOAD_DIR, fileName);
  console.log("uniqueFilename", uniqueFilename);
  // 开始合并文件
  const writeStream = fs.createWriteStream(
    path.join(UPLOAD_DIR, uniqueFilename)
  );
  writeStream.on("error", (err) => {
    console.log("err-merge::;", err);
  });
  for (let index = 0; index < chunkFileNames.length; index++) {
    const sort = chunkFileNames[index];
    const chunkPath = path.join(chunksDir, CHUNKNAME_FN(sort));
    const chunk = await fsPromises.readFile(chunkPath);
    const isWrite = writeStream.write(chunk);
    /***
     * Node.js 的 WriteStream 内部有一个缓冲区（内存中的临时存储区域）：
     * 当调用 writeStream.write(chunk) 时，数据会先进入缓冲区；
     * 缓冲区中的数据会被异步地写入磁盘（由 Node.js 底层处理）；
     * 如果缓冲区已满（比如写入速度超过磁盘处理速度），write() 方法会返回 false，表示暂时无法接受新数据。
     * */

    if (!isWrite) {
      console.log("写入流缓冲区满时：isWrite:", isWrite);
      // 写入流缓冲区满时，等待drain事件
      await new Promise((resolve) => writeStream.once("drain", resolve));
    }
  }
  await new Promise((resolve, reject) => {
    // 监听流的"finish"事件：所有数据已写入磁盘，且流已关闭
    writeStream.on("finish", resolve);
    // 监听流的"error"事件：写入过程中发生错误（如磁盘满、权限不足）
    writeStream.on("error", reject);
    // 触发流的结束流程（此时会开始清空缓冲区数据）
    writeStream.end();
  });
  // 直接删除目录可能有文件,操作系统的原因,删除不掉
  // fs.rmdirSync(chunksDir); // 删除分片目录
  await removeDir(chunksDir);
  console.log("chunksDir", "合并文件成功");
  res.status(200).json({ code: 200, message: "合并文件成功" });
});

/**
 * 基础文件下载接口 - 使用流式处理
 * @param {string} filename - 文件名
 */
router.get("/download/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, filename);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // 设置基本响应头
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", fileSize);

    // 处理Range请求（断点续传）
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      // 验证Range范围
      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        return res.end();
      }

      // 设置206部分内容响应头
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunksize);

      // 创建可读流（指定范围）
      const stream = fs.createReadStream(filePath, { start, end });

      // 处理流错误
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "文件读取失败" });
        }
      });
      // 客户端断开连接时清理资源
      req.on("aborted", () => {
        console.log("客户端中断下载:", filename);
        stream.destroy();
      });
      // 管道传输
      stream.pipe(res);
    } else {
      // 创建可读流并管道到响应
      const readStream = fs.createReadStream(filePath);

      // 错误处理
      readStream.on("error", (err) => {
        console.error("文件读取错误:", err);
        if (!res.headersSent) {
          res.status(500).json({ code: 500, message: "文件读取失败" });
        }
      });

      // 客户端断开连接时清理资源
      req.on("aborted", () => {
        console.log("客户端中断下载:", filename);
        readStream.destroy();
      });

      // 使用管道传输文件
      readStream.pipe(res);
    }
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "下载失败" });
  }
});

// 获取文件信息接口（用于前端获取文件大小）
router.get("/file-info/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    const stat = fs.statSync(filePath);
    res.json({
      filename,
      size: stat.size,
      lastModified: stat.mtime,
    });
  } catch (error) {
    console.error("File info error:", error);
    res.status(500).json({ error: "获取文件信息失败" });
  }
});

// 获取uploads目录下所有文件列表
router.get("/list", (req, res) => {
  try {
    // 检查uploads目录是否存在
    if (!fs.existsSync(UPLOAD_DIR)) {
      return res.status(404).json({
        code: 404,
        message: "uploads目录不存在",
        data: [],
      });
    }

    // 读取目录内容
    const files = fs.readdirSync(UPLOAD_DIR);

    // 过滤出文件（排除目录）并格式化返回数据
    const fileList = files
      .filter((item) => {
        const itemPath = path.join(UPLOAD_DIR, item);
        return fs.statSync(itemPath).isFile(); // 只返回文件，不包括目录
      })
      .map((filename) => ({
        label: filename,
        value: filename,
      }));

    res.status(200).json({
      code: 200,
      message: "获取文件列表成功",
      data: fileList,
    });
  } catch (error) {
    console.error("获取文件列表错误:", error);
    res.status(500).json({
      code: 500,
      message: "获取文件列表失败",
      error: error.message,
    });
  }
});

module.exports = router; // 导出路由
