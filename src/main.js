/*
 * @Autor: lcl
 * @Version: 2.0
 * @Date: 2022-07-19 09:07:53
 * @LastEditors: lcl
 * @LastEditTime: 2022-07-19 15:25:16
 * @Description: lcl
 */
import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import moment from 'moment';
import lodash from 'lodash';
import elementui from '@/plugins/elementui.js';
import storage from '@/plugins/storage.js';
import '@/plugins/rem.js';
// import ElementUI from '';

Vue.config.productionTip = false;
Vue.prototype.$moment = moment;
Vue.prototype.$lodash = lodash;

Vue.use(elementui);
Vue.use(storage);

new Vue({
  router,
  store,
  render: h => h(App),
}).$mount('#app');

console.log(process.env);
