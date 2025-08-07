module.exports = {
  // 一行最多 100 字符
  printWidth: 100,
  // 关闭 tab 缩进
  useTabs: false,
  // 使用 2个tab 缩进
  tabWidth: 2,
  // 行尾需要有分号
  semi: true,
  // 使用单引号
  singleQuote: true,
  // 对象key是否使用引号 <as-needed|consistent|preserve>
  // as-needed 仅在需要的时候使用
  // consistent 有一个属性需要引号，就都需要引号
  // preserve 保留用户输入的情况
  quoteProps: 'preserve',
  // jsx 使用单引号代替双引号
  jsxSingleQuote: false,
  // 末尾不需要逗号 <es5|none|all>
  trailingComma: 'es5',
  // 大括号内的首尾需要空格
  bracketSpacing: true,
  // jsx 标签的反尖括号需要换行
  jsxBracketSameLine: false,
  // 箭头函数，只有一个参数的时候，也需要括号 <always|avoid>
  arrowParens: 'avoid',
  // 每个文件格式化的范围是文件的全部内容
  rangeStart: 0,
  rangeEnd: Infinity,
  // 不需要写文件开头的 @prettier 用于逐步过渡大型项目中未被格式化的代码标识
  // requirePragma: false,
  // 不需要自动在文件开头插入 @prettier 用于逐步过渡大型项目中未被格式化的代码标识
  // insertPragma: false,
  // 使用默认的折行标准
  // proseWrap: 'preserve',
  // 根据显示样式决定 html 要不要折行 <css|strict|ignore>"
  // htmlWhitespaceSensitivity: 'css',
  // 换行符使用 lf 结尾  <lf|crlf|cr|auto>
  // endOfLine: 'lf',
  // embeddedLanguageFormatting: 'off',

  // printWidth: 800, //单行长度
  // tabWidth: 2, //缩进长度
  // useTabs: false, //使用空格代替tab缩进
  // semi: true, //句末使用分号
  // singleQuote: true, //使用单引号
  // quoteProps: 'as-needed', //仅在必需时为对象的key添加引号
  // jsxSingleQuote: true, // jsx中使用单引号
  // trailingComma: 'all', //多行时尽可能打印尾随逗号
  // bracketSpacing: true, //在对象前后添加空格
  // jsxBracketSameLine: true, //多属性html标签的‘>’折行放置
  // arrowParens: 'always', //单参数箭头函数参数周围使用圆括号
  // requirePragma: false, //无需顶部注释即可格式化
  // insertPragma: false, //在已被preitter格式化的文件顶部加上标注
  // htmlWhitespaceSensitivity: 'ignore', //对HTML全局空白不敏感
  vueIndentScriptAndStyle: false, //不对vue中的script及style标签缩进
  endOfLine: 'lf', //结束行形式
  embeddedLanguageFormatting: 'auto', //对引用代码进行格式化
  'prettier.proseWrap': 'preserve', // 是否要换行
  'vetur.format.defaultFormatter.js': 'prettier', // vetur 使用 prettier格式化代码
};
