<template>
  <el-container>
    <el-aside width="200px" style="height: 100vh">
      <el-menu :default-active="activeMenu" class="el-menu-vertical-demo" router>
        <MenuItem v-for="menu in menus" :key="menu.path" :menu="menu" />
      </el-menu>
    </el-aside>
    <el-container>
      <el-main> <RouterView /></el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
  import { RouterView, useRoute } from 'vue-router'
  import { routes } from './router'
  import { onMounted, ref } from 'vue'
  import MenuItem from './views/menuItem.vue'
  import { watchEffect } from 'vue'

  const route = useRoute()
  const activeMenu = ref(route.path)
  watchEffect(() => {
    activeMenu.value = route.path
  })

  const menus = ref<any[]>([])
  onMounted(() => {
    const getMenuFn = (routes: any[], menus: any[]) => {
      routes.forEach((v: any) => {
        const menu: any = {}
        menu.path = v.path
        menu.label = v.meta.label
        if (v?.children && v?.children.length) {
          menu.children = getMenuFn(v.children, [])
        }
        menus.push(menu)
      })
      return menus
    }
    if (routes?.length && routes[0].children) {
      menus.value = getMenuFn(routes[0].children, [])
      console.log(menus.value)
    }
  })
</script>
<style scoped></style>
