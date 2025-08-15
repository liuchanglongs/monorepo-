const path = require("path");
const fs = require("fs");

const CHUNKDIRNAME_FN = (chunkFilename) => `${chunkFilename}_CHUNKS`;
const CHUNKNAME_FN = (chunkIndex) => `chunk_${chunkIndex}`;

function getUniqueFilename(dir, filename) {
  let ext = path.extname(filename); // // 获取文件扩展名，如 ".jpg"
  let basename = path.basename(filename, ext); // 获取文件名，不包含扩展名
  let newFilename = filename; //  先假设原始文件名可用;
  let counter = 1;
  // 防止重复
  while (fs.existsSync(path.join(dir, CHUNKDIRNAME_FN(newFilename)))) {
    newFilename = `${basename}(${counter})${ext}`;
    counter++;
  }
  return newFilename;
}

module.exports = {
  getUniqueFilename,
  CHUNKDIRNAME_FN,
  CHUNKNAME_FN,
};
