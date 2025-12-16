const express = require('express');
const router = express.Router();
const db = require('../db');

// Helpers
const DEFAULT_STARTERS = [
  'Browse Products',
  'Track My Order',
  'Customer Support',
];

// ───────────────── GET appearance settings by store_url ─────────────────
router.get('/:storeUrl', async (req, res) => {
  const storeUrl = decodeURIComponent(req.params.storeUrl);

  try {
    const [rows] = await db.query(
      'SELECT * FROM chatbot_appearance WHERE store_url = ?',
      [storeUrl]
    );

    if (rows.length > 0) {
      const settings = { ...rows[0] };
      delete settings.id;
      delete settings.created_at;
      delete settings.updated_at;

      // conversation_starters normalization
      if (settings.conversation_starters) {
        if (typeof settings.conversation_starters === 'object') {
          if (Array.isArray(settings.conversation_starters)) {
            if (!settings.conversation_starters.length) {
              settings.conversation_starters = DEFAULT_STARTERS;
            }
          } else {
            const values = Object.values(settings.conversation_starters);
            settings.conversation_starters =
              values.length > 0 ? values : DEFAULT_STARTERS;
          }
        } else if (typeof settings.conversation_starters === 'string') {
          try {
            const parsed = JSON.parse(settings.conversation_starters);
            settings.conversation_starters =
              Array.isArray(parsed) && parsed.length > 0
                ? parsed
                : DEFAULT_STARTERS;
          } catch {
            settings.conversation_starters = DEFAULT_STARTERS;
          }
        }
      } else {
        settings.conversation_starters = DEFAULT_STARTERS;
      }

      // Defaults for new fields if null / missing
      settings.button_bg_color = settings.button_bg_color || null;
      settings.button_text_color = settings.button_text_color || '#ffffff';
      settings.button_shape = settings.button_shape || 'circle';
      settings.button_position = settings.button_position || 'right';
      settings.logo_url = settings.logo_url || null;
      settings.show_logo = !!settings.show_logo; // convert 0/1 -> boolean

      return res.json(settings);
    }

    // Default response if no record found
    return res.json({
      store_url: storeUrl,
      primary_color: '#1d306d',
      header_title: 'Quell AI',
      welcome_message:
        'Hi! 👋 I am Quell, your personal shopping assistant. What are you looking for today?',
      conversation_starters: DEFAULT_STARTERS,
      button_bg_color: null,
      button_text_color: '#ffffff',
      button_shape: 'circle',
      button_position: 'right',
      logo_url: null,
      show_logo: false,
    });
  } catch (error) {
    console.error('Error fetching appearance:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ───────────────── PUT save/update appearance settings ─────────────────
router.put('/:storeUrl', async (req, res) => {
  const storeUrl = decodeURIComponent(req.params.storeUrl);
  const data = req.body;

  try {
    // Ensure conversation_starters is an array
    let starters = data.conversation_starters || DEFAULT_STARTERS;
    if (!Array.isArray(starters) || !starters.length) {
      starters = DEFAULT_STARTERS;
    }

    const query = `
      INSERT INTO chatbot_appearance 
      (
        store_url,
        primary_color,
        header_title,
        welcome_message,
        conversation_starters,
        button_bg_color,
        button_text_color,
        button_shape,
        button_position,
        logo_url,
        show_logo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        primary_color = VALUES(primary_color),
        header_title = VALUES(header_title),
        welcome_message = VALUES(welcome_message),
        conversation_starters = VALUES(conversation_starters),
        button_bg_color = VALUES(button_bg_color),
        button_text_color = VALUES(button_text_color),
        button_shape = VALUES(button_shape),
        button_position = VALUES(button_position),
        logo_url = VALUES(logo_url),
        show_logo = VALUES(show_logo),
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(query, [
      storeUrl,
      data.primary_color || '#1d306d',
      data.header_title || 'Quell AI',
      data.welcome_message ||
        'Hi! 👋 I am Quell, your personal shopping assistant. What are you looking for today?',
      JSON.stringify(starters),
      data.button_bg_color || null,
      data.button_text_color || '#ffffff',
      data.button_shape || 'circle',
      data.button_position || 'right',
      data.logo_url || null,
      data.show_logo ? 1 : 0,
    ]);

    console.log(`✅ Appearance saved for ${storeUrl}`);
    return res.json({ success: true, message: 'Appearance settings saved' });
  } catch (error) {
    console.error('Error saving appearance:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
