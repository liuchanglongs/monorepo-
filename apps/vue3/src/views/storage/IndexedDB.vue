<template>
  <el-button @click="initIndexedDB" size="small">打开IndexedDB</el-button>
  <el-button @click="closeIndexedDB" size="small">关闭IndexedDB</el-button>
  <el-button @click="addIndexedDBData" size="small">添加数据</el-button>
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
        }
      })
    }

    /**
     * 设置数据库结构
     */
    private setupDatabase(db: IDBDatabase): void {
      // 我们的客户数据示例
      const customerData: Customer[] = [
        { ssn: '444-44-4444', name: 'Bill', age: 35, email: 'bill@company.com' },
        { ssn: '555-55-5555', name: 'Donna', age: 32, email: 'donna@home.org' },
      ]

      // 创建对象存储
      if (!db.objectStoreNames.contains('customers')) {
        const objectStore: IDBObjectStore = db.createObjectStore('customers', { keyPath: 'ssn' })

        // 创建索引
        objectStore.createIndex('name', 'name', { unique: false })
        objectStore.createIndex('email', 'email', { unique: true })

        // 使用事务的 oncomplete 事件确保在插入数据前对象存储已经创建完毕
        objectStore.transaction.oncomplete = () => {
          this.addInitialData(customerData)
        }
      }
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

        const transaction: IDBTransaction = this.db.transaction(['stu'], 'readwrite')
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

    /**
     * 删除数据库
     */
    static deleteDatabase(name: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const deleteRequest: IDBOpenDBRequest = window.indexedDB.deleteDatabase(name)

        deleteRequest.onsuccess = () => {
          console.log('数据库删除成功')
          resolve()
        }

        deleteRequest.onerror = () => {
          console.error('数据库删除失败')
          reject(deleteRequest.error)
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
</script>
