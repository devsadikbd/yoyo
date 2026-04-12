import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import stripe from '../lib/stripe.js'
import { 
  isMailEnabled, 
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail 
} from '../lib/mailer.js'

const router = Router()

// POST /api/orders  
router.post('/', requireAuth, async (req, res) => {
  console.log('Order request body:', req.body);
  const { paymentMethodId } = req.body
  if (!paymentMethodId) return res.status(400).json({ error: 'Payment method is required' })

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

    // 1. Create and confirm the payment intent
    const charge = await stripe.paymentIntents.create({
      amount: total,
      currency: 'USD',
      confirm: true,
      payment_method: paymentMethodId,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: `Sick Fits order for ${user.email}`
    })

    if (charge.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment failed' })
    }

    // 2. Create order + decrement stock + clear cart in one transaction
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
    console.error('Checkout error:', err)
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
      data: { status },
      include: { user: { select: { name: true, email: true } } }
    })

    if (isMailEnabled()) {
      sendOrderStatusUpdateEmail({
        to: order.user.email,
        customerName: order.user.name,
        order
      }).catch(err => {
        console.error('Order status update email failed:', err.message)
      })
    }

    res.json(order)
  } catch {
    res.status(404).json({ error: 'Order not found' })
  }
})

export default router
