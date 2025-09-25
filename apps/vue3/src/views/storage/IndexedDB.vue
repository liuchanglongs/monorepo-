<template>
  <el-button @click="initIndexedDB" size="small">打开IndexedDB</el-button>
  <el-button @click="closeIndexedDB" size="small">关闭IndexedDB</el-button>
  <el-button @click="addIndexedDBData" size="small">添加数据</el-button>
  <el-button @click="searchIndexedDBData" size="small">查询数据</el-button>
</template>

<script setup lang="ts">
  import { generateRandomCustomer, type Customer } from './utils'

  class NyIndexedDB {
    private db: IDBDatabase | null = null
    private name: string
    private version: number
    private isOpen: boolean = false

    constructor(name: string = 'MyTestDatabase', version: number = 3) {
      this.name = name
      this.version = version
    }

    /**
     * 打开数据库
     */
    openDB(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        if (this.isOpen && this.db) {
          resolve(this.db)
          return
        }
        const request: IDBOpenDBRequest = window.indexedDB.open(this.name, this.version)
        request.onerror = (event: Event) => {
          const error = (event.target as IDBOpenDBRequest)?.error
          console.error('IndexedDB 打开失败:', error)
          reject(error)
        }

        request.onsuccess = (event: Event) => {
          this.db = (event.target as IDBOpenDBRequest).result
          this.isOpen = true
          console.log('IndexedDB 打开成功')
          resolve(this.db)
        }
        // 数据库发生更新时的时候
        // 1. 版本号更新   2. 添加或者删除了表（对象仓库）的时候
        // 当我们第一次调用 open 方法时，会触发这个事件
        // 我们在这里来初始化我们的表
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          console.log('数据库版本更新')
          const db = (event.target as IDBOpenDBRequest).result
          // 创建数据仓库（表）
          var objectStore = db.createObjectStore('stu', {
            keyPath: 'stuId', // 这是主键
            autoIncrement: true, // 实现自增
          })

          // 创建索引
          objectStore.createIndex('nameIndex', 'name', { unique: false })
          objectStore.createIndex('ageIndex', 'age', { unique: false })
          objectStore.createIndex('emailIndex', 'email', { unique: false })
        }
      })
    }

    /**
     * 添加数据
     */
    async addData(data: Customer): Promise<void> {
      if (!this.db) {
        await this.openDB()
      }

      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('数据库未打开'))
          return
        }
        // 启动一个事务
        const transaction: IDBTransaction = this.db.transaction(['stu'], 'readwrite')
        // 使用事务对象
        const objectStore: IDBObjectStore = transaction.objectStore('stu')
        const request: IDBRequest = objectStore.add(data)
        request.onsuccess = () => {
          console.log('客户添加成功:', data)
          resolve()
        }

        request.onerror = () => {
          const error = request.error
          console.error('客户添加失败:', error)
          reject(error)
        }
      })
    }

    /**
     * 关闭数据库
     */
    close(): void {
      if (this.db) {
        this.db.close()
        this.db = null
        this.isOpen = false
        console.log('IndexedDB 已关闭')
      }
    }
    searchData() {
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('数据库未打开'))
          return
        }
        // 启动一个事务
        const transaction: IDBTransaction = this.db.transaction(['stu'], 'readonly')
        // 使用事务对象
        const objectStore: IDBObjectStore = transaction.objectStore('stu')
        /**
         * 1. 通过主键读取数据
         * */
        // // const request = objectStore.get(1758805353533)
        // const request = objectStore.getAll()
        // request.onsuccess = function (event: any) {
        //   console.log('通过主键查询结果', event.target.result)
        //   resolve(event.target.result)
        // }

        /**
         * 2. 通过索引读取数据
         * */
        // const index = objectStore.index('ageIndex')
        // // const request = index.getAll(IDBKeyRange.upperBound(50))
        // // 按照索引升序，找到第一个匹配
        // const request = index.get(IDBKeyRange.upperBound(50))

        // request.onsuccess = function (event: any) {
        //   console.log('通过索引查询结果', event.target.result)
        //   resolve(event.target.result)
        // }
        // request.onerror = function (event: any) {
        //   console.error('查询失败', event.target.error)
        //   reject(event.target.error)
        // }

        const request = objectStore.openCursor()
        const list: any[] = []
        request.onsuccess = function (event: any) {
          const cursor = event.target.result

          if (cursor) {
            list.push(cursor.value)
            cursor.continue()
          } else {
            resolve(list)
            console.log(list)
          }
        }
        request.onerror = function (event: any) {
          console.error('遍历失败', event.target.error)
          reject(event.target.error)
        }
      })
    }

    /**
     * 检查浏览器是否支持 IndexedDB
     */
    static isSupported(): boolean {
      return 'indexedDB' in window
    }
  }

  const myDB = new NyIndexedDB()

  const initIndexedDB = async () => {
    try {
      if (!NyIndexedDB.isSupported()) {
        console.error('浏览器不支持 IndexedDB')
        return
      }
      await myDB.openDB()
      console.log('IndexedDB 初始化成功')
    } catch (error) {
      console.error('IndexedDB 初始化失败:', error)
    }
  }

  const closeIndexedDB = () => {
    myDB.close()
  }

  const addIndexedDBData = () => {
    myDB.addData(generateRandomCustomer())
  }

  const searchIndexedDBData = () => {
    myDB.searchData()
  }
</script>
