// docs.js
const express = require('express');
const path = require('path');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

const router = express.Router();
const specPath = path.join(__dirname, 'openapi.yaml');

let openapiDocument;
try {
  openapiDocument = YAML.load(specPath);
} catch (err) {
  console.error('Failed to load openapi.yaml:', err);
  openapiDocument = { openapi: '3.0.3', info: { title: 'missing spec' } };
}

console.log('[docs] swagger docs module loaded');

router.get('/openapi.json', (req, res) => res.json(openapiDocument));
router.get('/openapi.yaml', (req, res) => res.sendFile(specPath));

router.use('/', swaggerUi.serve, swaggerUi.setup(openapiDocument, { explorer: true }));

module.exports = router;
