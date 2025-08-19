/*
 * @Autor: lcl
 * @Version: 2.0
 * @Date: 2022-07-19 14:12:40
 * @LastEditors: lcl
 * @LastEditTime: 2022-07-19 15:15:26
 * @Description: lcl
 */
const path = require("path");
function resolve(dir) {
  return path.join(__dirname, dir);
}
// 引入等比适配插件
const px2rem = require("postcss-px2rem");
// 配置基本大小
const postcss = px2rem({
  // 基准大小 baseSize，需要和rem.js中相同
  remUnit: 16,
});
module.exports = {
  devServer: {
    hot: true,
    proxy: {
      "/api": {
        //本地服务接口地址
        target: "http://192.168.170.61:510",
        // target: 'http://192.168.175.230:80',
        ws: true,
        pathRewrite: {
          "^/api": "/",
        },
      },
    },
  },
  chainWebpack: (config) => {
    config.resolve.alias
      .set("@", resolve("src"))
      .set("assets", resolve("src/assets"))
      .set("components", resolve("src/components"));
    // 新增 load.html 的处理配置
    config.plugin("html-load").use(require("html-webpack-plugin"), [
      {
        template: "public/other/load.html", // load.html 的路径
        filename: "/other/load.html", // 输出文件名
        templateParameters: {
          // 注入的全局变量
          APP_NAME: "我的应用",
          API_URL: "https://www.doubao.com/chat/17001215559706370",
          REQUEST_URL: "http:/183.230.9.103:40000",
        },
        inject: false, // 不自动注入入口JS
      },
    ]);
  },
  lintOnSave: true,
  css: {
    loaderOptions: {
      postcss: {
        plugins: [postcss],
      },
    },
  },
};
