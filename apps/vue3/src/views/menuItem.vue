<template>
  <el-sub-menu v-if="menu.children && menu.children.length" :index="menu.path">
    <template #title>
      <span>{{ menu.label }}</span>
    </template>
    <MenuItem v-for="child in menu.children" :key="child.path" :menu="child" />
  </el-sub-menu>
  <el-menu-item v-else :index="menu.path">
    <span>{{ menu.label }}</span>
  </el-menu-item>
</template>

<script setup lang="ts">
  interface Menu {
    path: string
    label: string
    children?: Menu[]
  }

  defineProps<{
    menu: Menu
  }>()
</script>
