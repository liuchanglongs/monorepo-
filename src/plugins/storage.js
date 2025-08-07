/*
 * @Autor: lcl
 * @Version: 2.0
 * @Date: 2022-07-19 15:24:25
 * @LastEditors: lcl
 * @LastEditTime: 2022-07-19 15:27:40
 * @Description: lcl
 */
import config from '@/config/env-api.js';

export default {
  getStorage() {
    return JSON.parse(window.localStorage.getItem(config.nameSpace) || '{}');
  },

  setItem(key, val) {
    let storage = this.getStorage();
    storage[key] = val;
    window.localStorage.setItem(config.nameSpace, JSON.stringify(storage));
  },

  getItem(key) {
    return this.getStorage()[key];
  },

  clearItem(key) {
    let storage = this.getStorage();
    delete storage[key];
    window.localStorage.setItem(config.nameSpace, JSON.stringify(storage));
  },

  clearAll() {
    window.localStorage.removeItem(config.nameSpace);
  },

  clearStorgae() {
    window.localStorage.clear();
  },
};
