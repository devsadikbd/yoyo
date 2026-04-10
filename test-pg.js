import pg from 'pg'

async function test() {
  console.log('Testing pg connection to:', process.env.DATABASE_URL.split('@')[1])
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000 
  })
  
  try {
    const res = await pool.query('SELECT NOW()')
    console.log('Connection successful:', res.rows[0])
  } catch (err) {
    console.error('Connection failed:', err.message)
    console.error('Full error:', err)
  } finally {
    await pool.end()
  }
}

test()
