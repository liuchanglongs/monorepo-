<template>
  <div class="L-from">
    <el-form ref="LFrom" :model="formData" :inline="isInline" :label-width="labelWidth" :rules="rules"
      :label-position="labelPosition" :size="size">
      <el-row>
        <el-col v-for="item in formConfig" :key="item.prop" :span="6">
          <el-form-item v-if="item.type === 'input'" :label="item.label" :prop="item.prop">
            <LInput :config="item" v-model:data="formData[item.model]"></LInput>
          </el-form-item>
          <el-form-item v-if="item.type === 'select'" :label="item.label" :prop="item.prop">
            <LSelect :config="item" v-model:data="formData[item.model]"></LSelect>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item>
            <el-button type="primary" @click="submitForm()">Search</el-button>
            <el-button @click="resetForm()">Reset</el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
  </div>
</template>

<script setup>
import LInput from './components/LInput.vue'
import LSelect from './components/LSelect.vue'
defineOptions({
  name: 'LFrom',
});
const { proxy } = getCurrentInstance();
const emit = defineEmits(["submitForm"]);
const props = defineProps({
  isInline: {
    type: Boolean,
    default: true
  },
  labelPosition: {
    // left top right
    type: String,
    default: "right"
  },
  labelWidth: {
    type: String,
    default: "80px"
  },
  size: {
    // large default small
    type: String,
    default: "default"
  },
  rules: {
    type: Object,
    default: () => { }
  },
  formData: {
    type: Object,
    default: () => { }
  },
  formConfig: {
    type: Array,
    default: () => {
      return [
        {
          type: null,
          label: null,
          prop: null,
          dataName: null,
          placeholder: null,
        }
      ]
    }
  }
});
const formData = computed(() => {
  return props.formData;
})

const resetForm = () => {
  proxy.$refs.LFrom.resetFields();
  emit("submitForm", formData);
};
const submitForm = () => {
  proxy.$refs.LFrom.validate((val) => {
    if (val) {
      emit("submitForm", formData.value);
    }
  })
};
</script>

<style lang="scss" scoped>
</style>