// import router from "./router";
// import store from "./store";
// import { getToken } from "@/utils/auth";
// router.beforeEach((to, from, next) => {
//   // debugger
//   const meta = to.meta || {};
//   if (getToken()) {
//     if (to.path === "/login") {
//       next({ path: "/" });
//     } else {
//       //如果用户信息为空则获取用户信息，获取用户信息失败，跳转到登录页
//       if (store.getters.token.length === 0) {
//         store.dispatch("FedLogOut").then(() => {
//           next({ path: "/login" });
//         });
//       } else {
//         const value = to.query.src || to.fullPath;
//         if (to.query.target) {
//           window.open(value);
//         }
//         next();
//       }
//     }
//   } else {
//     if (meta.requiresAuth === false) {
//       next();
//     } else {
//       localStorage.setItem("preRoute", to.fullPath);
//       // debugger
//       if (to.fullPath.includes("getShareFile")) {
//         next({ path: "/login", query: { link: to.query.link } });
//       } else {
//         next("/login");
//       }
//     }
//   }
// });

// router.afterEach(() => { });
