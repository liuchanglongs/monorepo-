import axios from 'axios';
import store from '@/store';
import router from '@/router';
import { getToken } from '@/utils/auth';
//  import { Notify } from 'vant';
import { Message } from 'element-ui';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

//默认超时时间
axios.defaults.timeout = 120000;
//返回其他状态码
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status <= 500;
};
//跨域请求，允许保存cookie
axios.defaults.withCredentials = true;
// NProgress 配置
NProgress.configure({
  showSpinner: false,
});
//http request拦截
axios.interceptors.request.use(
  config => {
    //开启 progress bar
    NProgress.start();
    const meta = config.meta || {};
    const isToken = meta.isToken === false;
    if (!config.url.startsWith('/up-api')) {
      config.headers['Authorization'] = `Basic c2FiZXI6c2FiZXJfc2VjcmV0`;
      //让每个请求携带token
      if (getToken() && !isToken) {
        config.headers['Blade-Auth'] = 'bearer ' + getToken();
      }
    }
    //headers中配置text请求
    if (config.text === true) {
      config.headers['Content-Type'] = 'text/plain';
    }
    //headers中配置serialize为true开启序列化
    // if (config.method === "post" && meta.isSerialize === true) {
    //   config.data = serialize(config.data);
    // }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);
//http response 拦截
axios.interceptors.response.use(
  res => {
    //关闭 progress bar
    NProgress.done();
    //获取状态码
    const status = res.data.code || res.status;
    const statusWhiteList = [];
    const message = res.data.msg || res.data.error_description || '未知错误';
    //如果在白名单里则自行catch逻辑处理
    if (statusWhiteList.includes(status)) return Promise.reject(res);
    //如果是401则跳转到登录页面
    if (status === 401) {
      store.dispatch('FedLogOut').then(() => {
        // resetRouter();
        router.push({ path: '/login' });
      });
    }

    // 如果请求为非200否者默认统一处理
    if (status !== 200) {
      Message({
        message: message,
        type: 'error',
        customClass: 'err-message',
      });
      return Promise.reject(new Error(message));
    }
    return res;
  },
  error => {
    NProgress.done();
    return Promise.reject(new Error(error));
  }
);

export default axios;
