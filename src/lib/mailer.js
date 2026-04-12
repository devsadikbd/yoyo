import nodemailer from 'nodemailer'

function getMailConfig() {
  const clean = (val) => (val || '').trim().replace(/^["']|["']$/g, '')
  
  const user = clean(process.env.GMAIL_USER)
  const pass = clean(process.env.GMAIL_APP_PASSWORD)
  const from = clean(process.env.EMAIL_FROM) || user

  return {
    user,
    pass,
    from,
    enabled: Boolean(user && pass)
  }
}

let transporter

function getTransporter() {
  if (transporter) return transporter

  const { user, pass } = getMailConfig()
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  })

  return transporter
}

export function isMailEnabled() {
  return getMailConfig().enabled
}

export async function sendWelcomeEmail({ to, name }) {
  if (!isMailEnabled() || !to) return

  const { from } = getMailConfig()
  await getTransporter().sendMail({
    from,
    to,
    subject: 'Welcome to Sick Fits!',
    text: `Hi ${name || 'there'},\n\nWelcome to Sick Fits! We're glad to have you here.\n\nYou can start browsing our collection and add items to your cart.\n\nBest,\nThe Sick Fits Team`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#393939;">
        <h1 style="display:inline-block;background:#dc2626;color:#fff;padding:8px 12px;margin:0 0 24px;">Sick Fits</h1>
        <p>Hi ${escapeHtml(name || 'there')},</p>
        <p>Welcome to Sick Fits! We're glad to have you here.</p>
        <p>You can start browsing our collection and add items to your cart.</p>
        <p>Best,<br>The Sick Fits Team</p>
      </div>
    `
  })
}

export async function sendOrderStatusUpdateEmail({ to, customerName, order }) {
  if (!isMailEnabled() || !to) return

  const { from } = getMailConfig()
  const statusLabel = order.status.charAt(0) + order.status.slice(1).toLowerCase()

  await getTransporter().sendMail({
    from,
    to,
    subject: `Order update: ${statusLabel} - ${order.id.slice(-8).toUpperCase()}`,
    text: [
      `Hi ${customerName || 'there'},`,
      '',
      `Your order ${order.id} status has been updated to: ${statusLabel}.`,
      '',
      'You can check your order details in your account page.',
      '',
      'Thanks for shopping with us!'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#393939;">
        <h1 style="display:inline-block;background:#dc2626;color:#fff;padding:8px 12px;margin:0 0 24px;">Sick Fits</h1>
        <p>Hi ${escapeHtml(customerName || 'there')},</p>
        <p>Your order status has been updated to: <strong>${escapeHtml(statusLabel)}</strong></p>
        <div style="background:#f9fafb;border-left:4px solid #dc2626;padding:16px;margin:24px 0;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
          <p style="margin:0;"><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
        </div>
        <p>You can check your order details in your account page.</p>
        <p>Thanks for shopping with us!</p>
      </div>
    `
  })
}

export async function sendOrderConfirmationEmail({ to, customerName, order }) {
  if (!isMailEnabled() || !to) return

  const { from } = getMailConfig()
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${item.product.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('')

  await getTransporter().sendMail({
    from,
    to,
    subject: `Order confirmation - ${order.id.slice(-8).toUpperCase()}`,
    text: [
      `Hi ${customerName || 'there'},`,
      '',
      `Thanks for your order from Sick Fits.`,
      `Order ID: ${order.id}`,
      `Status: ${order.status}`,
      `Total: ${formatPrice(order.total)}`,
      '',
      ...order.items.map(item => `- ${item.product.name} x${item.quantity} = ${formatPrice(item.price * item.quantity)}`),
      '',
      'We will email you again when your order status changes.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#393939;">
        <h1 style="display:inline-block;background:#dc2626;color:#fff;padding:8px 12px;margin:0 0 24px;">Sick Fits</h1>
        <p>Hi ${escapeHtml(customerName || 'there')},</p>
        <p>Thanks for your order. We have received it and started processing.</p>
        <div style="background:#f9fafb;border-left:4px solid #dc2626;padding:16px;margin:24px 0;">
          <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
          <p style="margin:0 0 8px;"><strong>Status:</strong> ${escapeHtml(order.status)}</p>
          <p style="margin:0;"><strong>Total:</strong> ${formatPrice(order.total)}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 0;border-bottom:2px solid #d1d5db;">Item</th>
              <th style="text-align:center;padding:8px 0;border-bottom:2px solid #d1d5db;">Qty</th>
              <th style="text-align:right;padding:8px 0;border-bottom:2px solid #d1d5db;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="color:#6b7280;">We will email you again when your order status changes.</p>
      </div>
    `
  })
}

export async function sendPasswordResetEmail({ to, resetToken }) {
  if (!isMailEnabled() || !to) return

  const { from } = getMailConfig()
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/reset?token=${resetToken}`

  await getTransporter().sendMail({
    from,
    to,
    subject: 'Sick Fits - Reset your password',
    text: [
      `You requested a password reset for your Sick Fits account.`,
      '',
      `Please click the link below to set a new password. This link is valid for 1 hour.`,
      '',
      resetUrl,
      '',
      'If you did not request this, please ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#393939;">
        <h1 style="display:inline-block;background:#dc2626;color:#fff;padding:8px 12px;margin:0 0 24px;">Sick Fits</h1>
        <p>You requested a password reset for your Sick Fits account.</p>
        <p>Please click the button below to set a new password. This link is valid for 1 hour.</p>
        <div style="margin:32px 0;">
          <a href="${resetUrl}" style="background:#dc2626;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:4px;">Reset Password</a>
        </div>
        <p style="font-size:14px;color:#6b7280;">If the button above doesn't work, copy and paste this URL into your browser:</p>
        <p style="font-size:14px;color:#6b7280;">${resetUrl}</p>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="font-size:14px;color:#6b7280;">If you did not request this, please ignore this email.</p>
      </div>
    `
  })
}

function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
