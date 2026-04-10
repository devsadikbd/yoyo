import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { isMailEnabled, sendOrderConfirmationEmail } from '../lib/mailer.js'

const router = Router()

// POST /api/orders  
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: true }
    })

    if (cartItems.length === 0)
      return res.status(400).json({ error: 'Cart is empty' })

    // Check stock for all items
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `Not enough stock for "${item.product.name}"`
        })
      }
    }

    const total = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

    // Create order + decrement stock + clear cart in one transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          total,
          items: {
            create: cartItems.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.product.price
            }))
          }
        },
        include: { items: { include: { product: true } } }
      })

      // Decrement stock
      await Promise.all(
        cartItems.map(i =>
          tx.product.update({
            where: { id: i.productId },
            data: { stock: { decrement: i.quantity } }
          })
        )
      )

      // Clear cart
      await tx.cartItem.deleteMany({ where: { userId: req.user.id } })

      return newOrder
    })

    if (isMailEnabled()) {
      try {
        await sendOrderConfirmationEmail({
          to: user.email,
          customerName: user.name,
          order
        })
      } catch (err) {
        console.error('Order confirmation email failed:', err.message)
      }
    }

    res.status(201).json(order)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' })
  }
})

router.get('/', requireAuth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(orders)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/all', requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(orders)
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body
  const valid = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']
  if (!valid.includes(status))
    return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` })

  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status }
    })
    res.json(order)
  } catch {
    res.status(404).json({ error: 'Order not found' })
  }
})

export default router
