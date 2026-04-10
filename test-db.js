import { prisma } from './src/lib/prisma.js'

async function test() {
  try {
    const products = await prisma.product.findMany({ take: 1 })
    console.log('Connection successful, found products:', products.length)
  } catch (err) {
    console.error('Connection failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()
