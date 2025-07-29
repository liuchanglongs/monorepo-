<!--
 * @Author: lcl
 * @Date: 2025/7/28
-->

1. 安装 pnpm
   npm install pnpm -g
   pnpm config get registry
   pnpm config set registry https://registry.npmmirror.com/

2. 初始化项目
   pnpm init

3. 创建 workspace(工作空间)
   apps、packages
   配置 workspaces：创建 pnpm-workspaces.yaml

4. apps 里 vue-project、react-project
   需要：
   vite、
   vue、@vitejs/plugin-vue
   react react-dom、@vitejs/plugin-react
   思考安装在哪里？全局，进行复用。
   <!-- pnmp -w / --F -filter -->总结常用的语法

   pnpm add vue react react-dom
   pnpm -D add vite @vitejs/plugin-vue @vitejs/plugin-react

5. 配置 apps 里面的项目
   配置 package.json 中的 name、main（三方库必须配置）
   初始化项目 : pnpm init

6. 配置项目启动脚本
   @monorepo/root:

   - "dev:Vue": "pnpm run --F @monorepo/vue-project dev",
   - "dev:React": "pnpm run --F @monorepo/react-project dev"
     @monorepo/react-project:
   - "dev": "vite"
     @monorepo/vue-project:
   - "dev": "vite"

7. 配置同时启动两个项目的启动脚本
   "dev": "pnpm -r --parallel --filter @monorepo/vue-project --filter @monorepo/react-project dev"
