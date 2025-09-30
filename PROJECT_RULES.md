# Monorepo 项目规则

## 项目概述

这是一个基于 **pnpm + Turbo** 的 monorepo 项目，包含多个前端应用和共享包，支持多种技术栈的统一管理和构建。

## 目录结构规范

### 根目录结构

```
monorepo/
├── apps/                    # 应用目录
│   ├── com_vue2/           # Vue 2 + Element UI 项目 (Vue CLI)
│   ├── vue-project/        # 简单 Vue 3 项目 (Vite)
│   ├── vue3/               # 完整 Vue 3 + TypeScript 项目 (Vite + Element Plus)
│   ├── react-project/      # React 项目 (Vite)
│   └── vue3-backend/       # Node.js Express 后端服务
├── packages/               # 共享包目录
│   └── utils/              # 通用工具包
├── .trae/                  # Trae AI 配置
├── .vscode/                # VS Code 配置
├── uploads/                # 文件上传目录
├── package.json            # 根包配置
├── pnpm-workspace.yaml     # pnpm 工作空间配置
└── turbo.json              # Turbo 构建配置
```

### 应用目录详细说明

- **com_vue2/**: Vue 2.6 + Element UI + Vue CLI 项目，使用 git subtree 管理
- **vue-project/**: 简单的 Vue 3 项目，使用 Vite 构建
- **vue3/**: 完整的 Vue 3 + TypeScript + Element Plus 项目，包含完整的开发配置
- **react-project/**: React 19 + Vite 项目
- **vue3-backend/**: Express 后端服务，端口 3023，支持文件上传

## 命名规范

### 包命名规范

- **命名空间**: 所有包使用 `@monorepo/` 作为命名空间前缀
- **应用包**: `@monorepo/app-name` (如 `@monorepo/vue3`, `@monorepo/react-project`)
- **工具包**: `@monorepo/utils`
- **后端服务**: `@monorepo/vue3-backend`

### 文件命名规范

- **Vue 组件**: PascalCase (如 `UserProfile.vue`)
- **工具函数**: camelCase (如 `formatDate.js`)
- **配置文件**: kebab-case (如 `vite.config.ts`)
- **路由文件**: camelCase (如 `userRoutes.js`)

## 技术栈规范

### 前端技术栈

#### Vue 2 项目 (com_vue2)
- **框架**: Vue 2.6.11
- **UI 库**: Element UI 2.15.9
- **构建工具**: Vue CLI 4.5.13
- **状态管理**: Vuex 3.4.0
- **路由**: Vue Router 3.2.0
- **HTTP 客户端**: Axios 0.27.2
- **工具库**: Lodash, Moment.js
- **样式**: Less

#### Vue 3 项目 (vue3)
- **框架**: Vue 3.5.18
- **UI 库**: Element Plus 2.10.6 (自动导入)
- **构建工具**: Vite 7.0.6
- **语言**: TypeScript 5.8.0
- **状态管理**: Pinia 3.0.3
- **路由**: Vue Router 4.5.1
- **Node 版本要求**: ^20.19.0 || >=22.12.0
- **样式**: Sass
- **开发工具**: Vue DevTools, ESLint, Prettier

#### React 项目 (react-project)
- **框架**: React 19.1.0
- **构建工具**: Vite 7.0.6
- **插件**: @vitejs/plugin-react 4.7.0

#### 简单 Vue 项目 (vue-project)
- **框架**: Vue 3 (继承自根目录)
- **构建工具**: Vite
- **依赖**: 使用 `@monorepo/utils` 工具包

### 后端技术栈

#### Node.js 服务 (vue3-backend)
- **框架**: Express 5.1.0
- **文件上传**: Multer 2.0.2, Busboy 1.6.0
- **跨域**: CORS 2.8.5
- **开发工具**: Nodemon 3.1.10
- **端口**: 3023
- **超时配置**: 4-5 分钟

### 包管理和构建

- **包管理器**: pnpm@10.13.1 (统一使用)
- **构建工具**: Turbo 2.5.5
- **工作空间**: pnpm workspace

## 开发规范

### 脚本命名规范

```json
{
  "dev": "启动开发服务器",
  "build": "构建生产版本", 
  "lint": "代码检查",
  "test": "运行测试",
  "preview": "预览构建结果",
  "type-check": "TypeScript 类型检查"
}
```

### 根目录脚本

```json
{
  "dev:Vue": "启动 Vue 项目",
  "dev:React": "启动 React 项目", 
  "dev:all": "并行启动所有前端项目",
  "dev": "使用 Turbo 启动所有应用",
  "build": "构建所有项目",
  "test": "运行所有测试",
  "lint": "检查所有项目代码"
}
```

### Git Subtree 管理

com_vue2 项目使用 git subtree 管理，相关脚本：

```json
{
  "add:com_vue2": "添加 subtree",
  "fetch:com_vue2": "获取远程更新",
  "pull:com_vue2": "拉取远程更新", 
  "push:com_vue2": "推送到远程仓库"
}
```

### 依赖管理规范

#### 共享依赖
安装在根目录的共享依赖：
- `vue`: 3.5.18
- `react`: 19.1.0
- `react-dom`: 19.1.0
- `element-plus`: 2.10.6
- `vite`: 7.0.6
- `turbo`: 2.5.5

#### 内部包引用
使用 `workspace:*` 引用内部包：
```json
{
  "dependencies": {
    "@monorepo/utils": "workspace:*"
  }
}
```

#### 特定应用依赖
- 每个应用的特定依赖安装在对应应用目录
- 避免重复安装相同版本的依赖

### 代码风格规范

#### Vue 3 项目
- **ESLint**: 使用 eslint.config.ts 配置
- **Prettier**: 使用 .prettierrc.json 配置
- **TypeScript**: 严格模式，配置路径别名 `@/*`
- **缩进**: 2 空格
- **引号**: 单引号
- **分号**: 不使用分号

#### Vue 2 项目
- **ESLint**: 使用传统 .eslintrc.js 配置
- **Prettier**: 集成在 ESLint 中
- **样式**: Less 预处理器

## 环境配置

### 开发环境配置

#### 端口分配
- **Vue 项目**: Vite 自动分配端口
- **React 项目**: Vite 自动分配端口
- **后端服务**: 3023

#### 代理配置
Vue 3 项目代理配置：
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3023',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api/, '')
    }
  }
}
```

#### 环境变量
- **开发环境**: `.env.development`
- **生产环境**: `.env.production`
- **测试环境**: `.env.test`

### Turbo 构建配置

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": []
    }
  }
}
```

## 最佳实践

### 1. 新增应用流程

1. 在 `apps/` 目录创建新应用
2. 配置 `package.json` 中的 name 字段（使用 `@monorepo/` 前缀）
3. 在根目录 `package.json` 添加对应的启动脚本
4. 更新 `turbo.json` 配置（如需要）
5. 配置必要的构建和开发脚本

### 2. 共享代码管理

1. 将通用代码放入 `packages/utils`
2. 使用 `workspace:*` 引用内部包
3. 修改共享包会自动更新到使用方
4. 保持工具包的模块化和可复用性

### 3. 开发环境启动

```bash
# 启动单个项目
pnpm dev:Vue
pnpm dev:React

# 启动所有前端项目
pnpm dev:all

# 使用 Turbo 启动（推荐）
pnpm dev
```

### 4. 代理和接口规范

- **前端项目**: 统一使用 `/api` 前缀访问后端接口
- **后端接口**: 去除 `/api` 前缀，直接定义路由
- **开发环境**: 自动代理到 `localhost:3023`
- **跨域处理**: 后端配置 CORS 允许所有源

### 5. 文件上传处理

- **后端**: 使用 multer 和 busboy 处理文件上传
- **支持**: 大文件分片上传
- **存储目录**: `uploads/`
- **超时配置**: 4-5 分钟处理大文件

## 注意事项和限制

### 1. 包管理器
- **强制使用**: pnpm@10.13.1
- **禁止混用**: 不要使用 npm 或 yarn
- **锁定文件**: 使用 pnpm-lock.yaml

### 2. Node.js 版本要求
- **Vue 3 项目**: Node.js ^20.19.0 || >=22.12.0
- **其他项目**: 建议使用相同版本保持一致性

### 3. TypeScript 配置
- **Vue 3 项目**: 使用 TypeScript 严格模式
- **类型定义**: 注意 auto-imports.d.ts 和 components.d.ts
- **路径别名**: 配置 `@/*` 指向 `src/`

### 4. Element Plus 使用
- **自动导入**: 无需手动引入组件和样式
- **按需加载**: 通过 unplugin-vue-components 实现
- **图标**: 使用 @element-plus/icons-vue

### 5. 代码检查
- **提交前**: 运行 lint 检查
- **自动修复**: 使用 `--fix` 参数
- **格式化**: 集成 Prettier 自动格式化

### 6. 环境隔离
- **配置文件**: 不同环境使用不同的配置文件
- **环境变量**: 正确设置开发、测试、生产环境变量
- **构建输出**: 确保不同环境的构建结果隔离

## 工具和插件推荐

### VS Code 插件
- **Vue Language Features (Volar)**: Vue 3 支持
- **TypeScript Vue Plugin (Volar)**: Vue 3 TypeScript 支持
- **ESLint**: 代码检查
- **Prettier**: 代码格式化
- **Auto Rename Tag**: 自动重命名标签

### 调试配置
- 已配置 VS Code launch.json
- 支持 Vue/React 项目调试
- 支持 TypeScript 源码调试

## 项目维护

### 定期维护任务
1. **依赖更新**: 定期更新依赖包版本
2. **安全检查**: 运行 `pnpm audit` 检查安全漏洞
3. **构建测试**: 确保所有项目能正常构建
4. **代码检查**: 保持代码质量和一致性

### 版本管理
- **语义化版本**: 遵循 semver 规范
- **变更日志**: 记录重要变更
- **标签管理**: 为重要版本打标签

这个项目规则文档涵盖了 monorepo 项目的所有重要方面，为团队开发提供了清晰的指导和规范。