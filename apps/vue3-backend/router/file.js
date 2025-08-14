const express = require("express");
const router = express.Router(); // 创建路由实例
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CHUNKDIRNAME_FN = (chunkFilename) => `${chunkFilename}_CHUNKS`;
const CHUNKNAME_FN = (chunkIndex) => `chunk_${chunkIndex}`;

/**
 * 通过 multer() 函数创建一个 upload 实例，配置项 { dest: "uploads/" } 指定了文件上传后的临时存储目录（项目根目录下的 uploads 文件夹）。
 * multer 是 Node.js 中处理 multipart/form-data 类型数据的中间件，专门用于接收文件上传（如图片、文档等），Express 本身不具备处理文件上传的能力，需要依赖此类中间件。
 * */
const upload = multer({ dest: "uploads/" }); // 设置上传目录
const UPLOAD_DIR = path.join(__dirname, "../uploads"); // 定义上传目录的绝对路径
/**
 * 上传切片
 * @param {chunkBlob}  切片文件的 Blob 对象的字段名
 * */
router.post("/upload", upload.single("chunkBlob"), (req, res) => {
  const { chunkHash, chunkFilename, chunkIndex } = req.body;
  const chunk = req.file;
  //   创建分片存储目录
  const chunkDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(chunkFilename));
  fs.mkdirSync(chunkDir, { recursive: true });
  const chunkPath = path.join(chunkDir, CHUNKNAME_FN(chunkIndex));
  //   /uploads中的文件移动到chunkPath目录
  fs.rename(chunk.path, chunkPath, (err) => {
    if (err) {
      res
        .status(500)
        .json({ code: 500, message: "分片存储失败", error: err.message });
    } else {
      fs.unlink(chunk.path, () => {});
      res.status(200).json({ code: 200, message: "分片上传成功" });
    }
  });
});

/**
 * 获取已经上传的切片
 * @param {string} fileName - 文件名
 * */
router.get("/get-uploaded-chunks", (req, res) => {
  let uploadedChunks = [];
  const chunksDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(req.query.fileName));
  //   console.log("chunksDir:", chunksDir);
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
router.post("/merge", (req, res) => {
  const { fileName } = req.body;
  console.log("合并切片，fileName:", fileName);
  res.status(200).json({ code: 200, message: "合并文件成功" });
});

module.exports = router; // 导出路由
