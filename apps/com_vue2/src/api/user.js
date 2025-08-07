/*
 * @Description: token相关
 * @Autor: Tlx
 * @Date: 2022-05-24 10:55:59
 * @LastEditors: Tlx
 * @LastEditTime: 2022-06-20 14:42:06
 */
import request from '@/utils/axios.js'
import md5 from 'js-md5'


export const loginByUsername = (username, password) => request({
  url: '/api/blade-auth/oauth/token',
  method: 'post',
  headers: {
    'Tenant-Id': '191018',
    'Authorization': 'Basic c3dvcmQ6c3dvcmRfc2VjcmV0',
    'application': 'resource_system',
  },
  params: {
    tenantId: '191018',
    username,
    password: md5(password),
    grant_type: "password",
    scope: "all",
    type: 'account'
  }
});

export const refreshToken = (refresh_token, tenantId) => request({
  url: '/api/blade-auth/oauth/token',
  method: 'post',
  headers: {
    'Tenant-Id': '191018',
    'application': 'resource_system'
  },
  params: {
    tenantId,
    refresh_token,
    grant_type: "refresh_token",
    scope: "all",
  }
});

export const logout = () => request({
  url: '/api/blade-auth/oauth/logout',
  method: 'get'
});


// 获取短信验证码
export const sendMessage = (params) => request({
  url: `/api/sc-common/sendMessage`,
  method: 'post',
  params
})

// 手机验证码验证
export const verifyCode = (params) => request({
  url: `/api/sc-common/verifyCode`,
  method: 'get',
  params
})

// 新密码
export const changePassword = (data) => request({
  url: `/api/blade-user/changePasswordBytelePhone`,
  method: 'post',
  data
})

// 获取用户信息
export const getUserInfo =  () => request({
  url: '/api/blade-auth/oauth/user-info',
  method: 'get'
})