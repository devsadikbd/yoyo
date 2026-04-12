import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/users - List all users (Admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/users/:id/role - Update user role (Admin only)
router.patch('/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body
  const validRoles = ['USER', 'ADMIN', 'MANAGER', 'CUSTOMER']
  
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` })
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json(updatedUser)
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' })
    }
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
