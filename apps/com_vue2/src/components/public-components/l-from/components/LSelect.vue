<template>
  <div>
    <el-select v-model.trim="seLectData" v-bind="props.config">
      <el-option v-for="item in props.config.options" :key="item.label" :label="item.label" :value="item.value">
      </el-option>
    </el-select>
  </div>
</template>

<script setup>
defineOptions({
  name: 'LSelect',
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

const seLectData = computed({
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