<template>
  <div class="l-table">
    <el-table ref="LTable" v-bind="tableConfig" :data="tableData" style="width: 100%"
      @selection-change="selectionChange">
      <el-table-column v-for="item in tableColumns" :key="item.prop" :formatter="item.formatter" :prop="item.prop"
        :label="item.label" :width="item.width">
        <template #default="{ row, column, $index }" v-if="item.slotName">
          <slot :name="item.slotName" :item="item" :column="column" :index="$index" :row="row"></slot>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-bind="paginationConfig" :page-size="paginationData.pageSize" :total="paginationData.total"
      @current-change="handleCurrentChange" />
  </div>
</template>

<script setup>
const emit = defineEmits(["currentPage"]);

const props = defineProps({
  tableConfig: {
    type: Object,
    default: () => {
      return {
        "stripe": true,
        "empty-text": "No data"
      }
    }
  },
  tableData: {
    type: Array,
    default: () => []
  },
  tableColumns: {
    type: Array,
    default: () => {
      return [
        {
          prop: "name",
          label: "name",
          width: "180",
          formatter: (item) => {
            return item
          }
        }
      ]
    }
  },
  paginationConfig: {
    type: Object,
    default: () => {
      return {
        "small": true,
        "background": true,
        //  "layout":'total,slot,prev,pager,next,slot,sizes,jumper',
        "layout": 'prev,pager,next',
        "disabled": false
      }
    }
  },
  paginationData: {
    type: Object,
    default: () => {
      return {
        pageSize: 10,
        total: 10,
        pageNum: 1
      }
    }
  }
});

const selectionChange = () => {

};

const handleCurrentChange = (val) => {
  emit("currentPage", { pageNum: val })
}
</script>

<style lang="scss" scoped>
</style>