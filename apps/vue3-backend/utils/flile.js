const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;

const CHUNKDIRNAME_FN = (chunkFilename) => `${chunkFilename}_CHUNKS`;
const CHUNKNAME_FN = (chunkIndex) => `chunk_${chunkIndex}`;

function getUniqueFilename(dir, filename) {
  let ext = path.extname(filename); // // 获取文件扩展名，如 ".jpg"
  let basename = path.basename(filename, ext); // 获取文件名，不包含扩展名
  let newFilename = filename; //  先假设原始文件名可用;
  let counter = 1;
  let nextFileName = `${basename}(${counter})${ext}`;

  // 防止重复
  while (
    fs.existsSync(path.join(dir, CHUNKDIRNAME_FN(newFilename))) ||
    fs.existsSync(path.join(dir, nextFileName))
  ) {
    nextFileName = `${basename}(${++counter})${ext}`;
    newFilename = nextFileName;
  }
  return newFilename;
}

async function removeDir(dir) {
  try {
    const files = await fsPromises.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const isDir = await fsPromises.lstat(filePath);
      if (isDir.isDirectory()) {
        await removeDir(filePath);
      } else {
        await fsPromises.unlink(filePath);
      }
    }
    await fsPromises.rmdir(dir);
  } catch (error) {
    console.log("removeDir", error);
  }
}
module.exports = {
  getUniqueFilename,
  CHUNKDIRNAME_FN,
  CHUNKNAME_FN,
  removeDir,
};
