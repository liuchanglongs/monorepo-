// 定义客户数据接口
export interface Customer {
  stuId: number
  name: string
  age: number
  email: string
}

/**
 * 随机生成年龄
 * @param min 最小年龄，默认18
 * @param max 最大年龄，默认80
 * @returns 随机年龄
 */
const generateRandomAge = (min: number = 18, max: number = 80): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 随机生成姓名
 */
const generateRandomName = (): string => {
  const firstNames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴']
  const lastNames = [
    '伟',
    '芳',
    '娜',
    '敏',
    '静',
    '丽',
    '强',
    '磊',
    '军',
    '洋',
    '勇',
    '艳',
    '杰',
    '涛',
    '明',
    '超',
    '秀英',
    '霞',
    '平',
    '刚',
  ]

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]

  return firstName + lastName
}

/**
 * 随机生成邮箱
 */
const generateRandomEmail = (name: string): string => {
  const domains = ['gmail.com', 'qq.com', '163.com', 'hotmail.com', 'yahoo.com']
  const domain = domains[Math.floor(Math.random() * domains.length)]
  const randomNum = Math.floor(Math.random() * 1000)

  return `${name.toLowerCase()}${randomNum}@${domain}`
}

/**
 * 生成随机客户数据
 */
export const generateRandomCustomer = (): Customer => {
  const name = generateRandomName()
  const age = generateRandomAge()
  const email = generateRandomEmail(name)

  return {
    name,
    age,
    email,
    stuId: new Date().getTime(),
  }
}
