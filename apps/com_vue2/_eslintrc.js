module.exports = {
  root: true, // 停止在父级目录中寻找
  env: {
    es6: true, // 启用 ES6 语法支持以及新的 ES6 全局变量或类型
    node: true // Node.js 全局变量和 Node.js 作用域
  },
  extends: ['plugin:vue/essential'],
  rules: {
    // "quotes": 2, // 双引号
    // "semi": 1, // 是否需要分号
    // "no-console": 1, // 0是忽略，1是警告，2是报错
    // "space-before-function-paren": 0
  },
  parserOptions: {
    parser: 'babel-eslint'
  },
  overrides: [
  ]
};