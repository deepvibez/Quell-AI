// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Force IST timezone on every connection
pool.on('connection', (connection) => {
  connection.query(`SET time_zone='${process.env.DB_TIMEZONE || "+05:30"}';`, (error) => {
    if (error) {
      console.error('❌ Failed to set timezone:', error);
    } else {
      console.log('✅ Connection timezone set to IST (+05:30)');
    }
  });
});

pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = pool;
