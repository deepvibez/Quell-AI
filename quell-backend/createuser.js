const bcrypt = require('bcryptjs');
const db = require('./db');

async function createUser() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  const name = process.env.SEED_NAME;
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );
    
    console.log(' User created successfully!');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('  User already exists!');
    } else {
      console.error(' Error:', error.message);
    }
  }
  
  process.exit(0);
}

createUser().catch(err => {
  console.error(' Fatal error:', err);
  process.exit(1);
});
