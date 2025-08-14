const express = require("express");
const fileRoutes = require("./router/file.js"); // 引入用户路由
const cors = require("cors");

const port = 3023;
const app = express();
// 解析 JSON 格式的请求体
app.use(express.json());

// 挂载路由：所有以 /file 开头的请求都由 fileRoutes 处理
app.use("/file", fileRoutes);

app.use(
  cors({
    origin: "*", // 允许所有源访问
    //   methods: ['GET', 'POST', 'PUT', 'DELETE'],
    methods: "*",
    //   allowedHeaders: ['Content-Type']
    allowedHeaders: "*",
  })
);

app.listen(port, () => {
  console.log(`服务已经启动 请访问: http://localhost:${port}`);
});
