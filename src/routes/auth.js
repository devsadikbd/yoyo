import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { sendWelcomeEmail, sendPasswordResetEmail } from '../lib/mailer.js'

const router = Router()

router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' })
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })

  try {
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase().trim(), password: hashed },
      select: { id: true, name: true, email: true, role: true }
    })
    
    // Send welcome email (don't await so it doesn't block response)
    sendWelcomeEmail({ to: user.email, name: user.name }).catch(err => {
      console.error('Welcome email failed:', err.message)
    })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.status(201).json({ token, user })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Email already registered' })
    }
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' })

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    })
  } catch {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/request-reset', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required' })

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' })
    }

    const resetToken = crypto.randomBytes(20).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    })

    await sendPasswordResetEmail({ to: user.email, resetToken })

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' })
  } catch (err) {
    console.error('Password reset request failed:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() }
      }
    })

    if (!user) {
      return res.status(400).json({ error: 'Token is invalid or has expired' })
    }

    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpiry: null
      }
    })

    res.json({ message: 'Password has been reset successfully. You can now log in.' })
  } catch (err) {
    console.error('Password reset failed:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true }
    })
    res.json(user)
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
