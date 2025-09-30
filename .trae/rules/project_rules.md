# Monorepo 项目个人规则

## 项目概述

这是一个基于 pnpm + Turbo 的 monorepo 项目，包含多个前端应用和共享包。

## 目录结构规范

### 根目录结构

```
monorepo/
├── apps/           # 应用目录
├── packages/       # 共享包目录
├── .trae/          # Trae AI 配置
├── .vscode/        # VS Code 配置
├── uploads/        # 文件上传目录
├── package.json    # 根包配置
├── pnpm-workspace.yaml  # pnpm 工作空间配置
└── turbo.json      # Turbo 构建配置
```

### 应用目录 (apps/)

- `com_vue2/` - Vue 2 + Element UI 项目 (Vue CLI)
- `vue-project/` - 简单 Vue 3 项目 (Vite)
- `vue3/` - 完整 Vue 3 + TypeScript 项目 (Vite + Element Plus)
- `react-project/` - React 项目 (Vite)
- `vue3-backend/` - Node.js Express 后端服务

### 共享包目录 (packages/)

- `utils/` - 通用工具包

## 命名规范

### 包命名

- 所有包使用 `@monorepo/` 作为命名空间前缀
- 应用包：`@monorepo/app-name`
- 工具包：`@monorepo/utils`

### 文件命名

- Vue 组件：PascalCase (如 `UserProfile.vue`)
- 工具函数：camelCase (如 `formatDate.js`)
- 配置文件：kebab-case (如 `vite.config.js`)

## 技术栈规范

### 前端技术栈

- **Vue 2 项目**: Vue 2.6 + Element UI + Vue CLI
- **Vue 3 项目**: Vue 3.5 + Element Plus + Vite + TypeScript
- **React 项目**: React 19 + Vite
- **构建工具**: Vite (推荐) / Vue CLI (遗留项目)

### 后端技术栈

- **Node.js**: Express + multer + cors
- **开发工具**: nodemon

### 包管理

- **包管理器**: pnpm (统一使用)
- **版本**: pnpm@10.13.1
- **构建工具**: Turbo

## 开发规范

### 脚本命名

```json
{
  "dev": "启动开发服务器",
  "build": "构建生产版本",
  "lint": "代码检查",
  "test": "运行测试"
}
```

### 依赖管理

- 共享依赖安装在根目录
- 特定应用依赖安装在对应应用目录
- 使用 `workspace:*` 引用内部包

### 代码风格

- **Vue 项目**: 使用 ESLint + Prettier
- **TypeScript**: 严格模式，配置路径别名 `@/*`
- **缩进**: 2 空格
- **引号**: 单引号
- **分号**: 不使用分号 (Vue 3 项目)

## Git 规范

### 忽略文件

- `node_modules/`
- `dist/`
- `.turbo/`
- `uploads/` (后端上传文件)

### 子树管理

- `com_vue2` 项目使用 git subtree 管理
- 相关脚本：`add:com_vue2`, `pull:com_vue2`, `push:com_vue2`

## 环境配置

### 开发环境

- Vue 项目默认端口由 Vite 自动分配
- 后端服务端口：3023
- 代理配置：`/api` -> `http://localhost:3023`

### 环境变量

- 开发环境：`.env.development`
- 生产环境：`.env.production`
- 测试环境：`.env.test`

## 构建和部署

### Turbo 配置

- `build`: 构建所有项目
- `dev`: 并行启动开发服务器
- `lint`: 代码检查
- `test`: 运行测试

### 启动脚本

```bash
# 启动单个项目
pnpm dev:Vue
pnpm dev:React

# 启动所有前端项目
pnpm dev:all

# 使用 Turbo 启动
pnpm dev
```

## 最佳实践

### 1. 新增应用

1. 在 `apps/` 目录创建新应用
2. 配置 `package.json` 中的 name 字段
3. 在根目录 `package.json` 添加启动脚本
4. 更新 `turbo.json` 配置

### 2. 共享代码

1. 将通用代码放入 `packages/utils`
2. 使用 `workspace:*` 引用
3. 修改共享包会自动更新到使用方

### 3. 代理配置

- 前端项目统一使用 `/api` 前缀
- 后端接口去除 `/api` 前缀
- 开发环境代理到 `localhost:3023`

### 4. 文件上传

- 后端使用 multer 处理文件上传
- 支持大文件分片上传
- 上传目录：`uploads/`

## 注意事项

1. **包管理器**: 统一使用 pnpm，不要混用 npm/yarn
2. **Node 版本**: Vue 3 项目要求 Node.js ^20.19.0 || >=22.12.0
3. **TypeScript**: Vue 3 项目使用 TypeScript，注意类型定义
4. **Element Plus**: 使用自动导入，无需手动引入组件
5. **代码检查**: 提交前运行 lint 检查
6. **环境隔离**: 不同环境使用不同的配置文件

## 工具配置

### VS Code 推荐插件

- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- ESLint
- Prettier
- Auto Rename Tag

### 调试配置

- 已配置 VS Code launch.json
- 支持 Vue/React 项目调试
