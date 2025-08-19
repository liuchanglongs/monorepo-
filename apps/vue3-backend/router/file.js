const {
  getUniqueFilename,
  CHUNKDIRNAME_FN,
  CHUNKNAME_FN,
} = require("../utils/flile");
const express = require("express");
const router = express.Router(); // 创建路由实例
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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
 * 上传切片
 * @param {chunkBlob}  切片文件的 Blob 对象的字段名
 * */

router.post("/upload", (req, res) => {
  const bb = busboy({ headers: req.headers });
  let chunkHash, chunkFilename, chunkIndex;
  bb.on("field", (name, val) => {
    if (name === "chunkHash") chunkHash = val;
    if (name === "chunkFilename") chunkFilename = val;
    if (name === "chunkIndex") chunkIndex = val;
  });
  bb.on("file", (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log("name", name);
    console.log("info", info);
    debugger;
  });

  // bb.on("close", () => {
  //   console.log("Done parsing form!");
  //   res.writeHead(303, { Connection: "close", Location: "/" });
  //   res.end();
  // });
  req.pipe(bb);
  res.status(200).json({ code: 200, message: "分片存储失败" });
  // const chunk = req.file;
  // console.log("chunk.path", chunk.path);

  // //   创建分片存储目录
  // const chunkDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(chunkFilename));
  // if (!fs.existsSync(chunkDir)) {
  //   fs.mkdirSync(chunkDir);
  // }
  // const chunkPath = path.join(chunkDir, CHUNKNAME_FN(chunkIndex));
  // //   /uploads中的文件移动到chunkPath目录
  // fs.rename(chunk.path, chunkPath, (err) => {
  //   if (err) {
  // res
  //   .status(500)
  //   .json({ code: 500, message: "分片存储失败", error: err.message });
  //   } else {
  //     // 现代版本的 multer 会自动处理临时文件的清理，无需手动删除
  //     // 理论上，fs.rename 移动文件后，原临时文件（chunk.path）会被自动删除，但在某些特殊场景下（比如跨分区移动文件），rename 可能会采用复制 + 删除的方式，此时原文件可能残留
  //     // fs.unlink(chunk.path) 是一道保险措施，确保临时文件被彻底删除，避免磁盘空间被无效的临时文件占用。
  //     fs.unlink(chunk.path, (err) => {
  //       // console.warn(`warn deleting file ${chunk.path}:`, err);
  //     });
  //     res.status(200).json({ code: 200, message: "分片上传成功" });
  //   }
  // });
});

// router.post("/upload", upload.single("chunkBlob"), (req, res) => {
//   const { chunkHash, chunkFilename, chunkIndex } = req.body;
//   const chunk = req.file;
//   console.log("chunk.path", chunk.path);

//   //   创建分片存储目录
//   const chunkDir = path.join(UPLOAD_DIR, CHUNKDIRNAME_FN(chunkFilename));
//   if (!fs.existsSync(chunkDir)) {
//     fs.mkdirSync(chunkDir);
//   }
//   const chunkPath = path.join(chunkDir, CHUNKNAME_FN(chunkIndex));
//   //   /uploads中的文件移动到chunkPath目录
//   fs.rename(chunk.path, chunkPath, (err) => {
//     if (err) {
//       res
//         .status(500)
//         .json({ code: 500, message: "分片存储失败", error: err.message });
//     } else {
//       // 现代版本的 multer 会自动处理临时文件的清理，无需手动删除
//       // 理论上，fs.rename 移动文件后，原临时文件（chunk.path）会被自动删除，但在某些特殊场景下（比如跨分区移动文件），rename 可能会采用复制 + 删除的方式，此时原文件可能残留
//       // fs.unlink(chunk.path) 是一道保险措施，确保临时文件被彻底删除，避免磁盘空间被无效的临时文件占用。
//       fs.unlink(chunk.path, (err) => {
//         // console.warn(`warn deleting file ${chunk.path}:`, err);
//       });
//       res.status(200).json({ code: 200, message: "分片上传成功" });
//     }
//   });
// });

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
  console.log("chunksDir:", chunksDir);
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
  for (let index = 0; index < chunkFileNames.length; index++) {
    const sort = chunkFileNames[index];
    const chunkPath = path.join(chunksDir, CHUNKNAME_FN(sort));
    const chunk = fs.readFileSync(chunkPath);
    writeStream.write(chunk);
    fs.unlinkSync(chunkPath); // 删除分片文件
  }
  writeStream.end();
  fs.rmdirSync(chunksDir); // 删除分片目录
  res.status(200).json({ code: 200, message: "合并文件成功" });
});

module.exports = router; // 导出路由
