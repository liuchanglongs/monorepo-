/*
 * @Autor: lcl
 * @Version: 2.0
 * @Date: 2022-07-19 09:28:09
 * @LastEditors: lcl
 * @LastEditTime: 2022-07-19 15:28:36
 * @Description: lcl
 */
// 环境配置
const env = process.env.NODE_ENV || 'prod';
const envConfig = {
  dev: {
    baseApi: '/api',
    mockApi: 'https://www.fastmock.site/mock/3df3734293ee828e14cedc9fdc6e89a7/api',
  },
  prod: {
    baseApi: '',
    mockApi: 'https://www.fastmock.site/mock/3df3734293ee828e14cedc9fdc6e89a7/api',
  },
  test: {
    baseApi: '',
    mockApi: 'https://www.fastmock.site/mock/3df3734293ee828e14cedc9fdc6e89a7/api',
  },
};

export default {
  env,
  mock: false,
  nameSpace: 'LclV3demo',
  ...envConfig[env],
};
