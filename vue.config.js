/*
 * @Autor: lcl
 * @Version: 2.0
 * @Date: 2022-07-19 14:12:40
 * @LastEditors: lcl
 * @LastEditTime: 2022-07-19 15:15:26
 * @Description: lcl
 */
const path = require('path');
function resolve(dir) {
  return path.join(__dirname, dir);
}
// 引入等比适配插件
const px2rem = require('postcss-px2rem');
// 配置基本大小
const postcss = px2rem({
  // 基准大小 baseSize，需要和rem.js中相同
  remUnit: 16,
});
module.exports = {
  devServer: {
    hot: true,
    proxy: {
      '/api': {
        //本地服务接口地址
        target: 'http://192.168.170.61:510',
        // target: 'http://192.168.175.230:80',
        ws: true,
        pathRewrite: {
          '^/api': '/',
        },
      },
    },
  },
  chainWebpack: config => {
    config.resolve.alias
      .set('@', resolve('src'))
      .set('assets', resolve('src/assets'))
      .set('components', resolve('src/components'));
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
