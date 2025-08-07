import store from "@/store/index.js"

const permission = {
  mounted (el, val) {
    const actionButton = store.state.buttonPermission;
    if (!actionButton.includes(val.value)) {
      el.style = "display:none";
      el.parentNode.removeChild(el);
    }
  }
};

export default permission