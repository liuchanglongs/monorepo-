<template>
  <div>
    <el-input v-model.trim="iputData" v-bind="props.config" />
  </div>
</template>

<script setup>
defineOptions({
  name: 'LInput',
});
const emit = defineEmits(["update:data"]);
const props = defineProps({
  config: {
    type: Object,
    default: () => { }
  },
  data: {
    type: String,
    default: ""
  },
});

const iputData = computed({
  get () {
    return props.data;
  },
  set (val) {
    // setter
    emit("update:data", val);
  },
});
</script>

<style lang="scss" scoped>
</style>