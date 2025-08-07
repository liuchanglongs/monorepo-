<template>
  <div>
    <input v-model.trim="value" />
  </div>
</template>

<script setup>
const emit = defineEmits(["update:name"]);
const props = defineProps({
  name: {
    type: String,
    default: ""
  }
});

const value = computed({
  get () {
    return props.name;
  },
  set (val) {
    // setter
    console.log(val);
    emit("update:name", val)
  },
})
</script>

<style lang="scss" scoped>
</style>