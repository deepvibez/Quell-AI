// Services/messageService.js
const db = require("../db");

async function saveChatTurn({
  store_url,
  session_id,
  customer_id, // <--- NEW PARAMETER
  channel = "website",
  user_email = null,
  user_name = null,
  user_message = null,
  bot_response = null,
  message_json = null,
}) {
  // Update SQL to include customer_id
  const sql = `
    INSERT INTO messages
    (store_url, session_id, customer_id, channel, user_email, user_name, user_message, bot_response, message_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  
  const params = [
    store_url,
    session_id,
    customer_id || null, // <--- Save the ID here
    channel,
    user_email || null,
    user_name || null,
    user_message || null,
    bot_response || null,
    message_json ? JSON.stringify(message_json) : null
    // created_at is handled by NOW()
  ];

  try {
    const [result] = await db.execute(sql, params);
    return result.insertId;
  } catch (error) {
    console.error("❌ Error saving chat turn:", error);
    // Don't crash the chat if logging fails, but log the error
    return null; 
  }
}

module.exports = { saveChatTurn };