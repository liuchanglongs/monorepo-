<!--
 * @Author: lcl
 * @Date: 2025/7/28
-->

<template>
  <div>vue-project</div>
</template>
<script setup>
import { onMounted } from "vue";
import { testfn } from "../../../packages/utils";

onMounted(() => {
  testfn("onMounted - vue-project");
  console.log("Vue project mounted");
});
</script>
<style scoped></style>
