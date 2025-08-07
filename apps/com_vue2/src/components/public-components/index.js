import LFrom from "./l-from/index.vue";
import Ltable from "./l-table/index.vue";
export default {
  install (Vue, options) {
    Vue.component("LFrom", LFrom);
    Vue.component("Ltable", Ltable);
  },
};
