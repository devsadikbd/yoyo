import nodemailer from 'nodemailer'

function getMailConfig() {
  const user = (process.env.GMAIL_USER || '').trim()
  const pass = (process.env.GMAIL_APP_PASSWORD || '').trim()
  const from = (process.env.EMAIL_FROM || user).trim()

  return {
    user,
    pass,
    from,
    enabled: Boolean(user && pass && from)
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
