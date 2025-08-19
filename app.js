const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Allowed domains for form submissions
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS
  ? process.env.ALLOWED_DOMAINS.split(',')
  : ['localhost'];

// Domain validation middleware
const validateDomain = (req, res, next) => {
  const origin = req.get('origin');
  const referer = req.get('referer');
  
  // Extract domain from origin or referer
  let domain = null;
  if (origin) {
    try {
      domain = new URL(origin).hostname;
    } catch (e) {
      // Invalid origin URL
    }
  } else if (referer) {
    try {
      domain = new URL(referer).hostname;
    } catch (e) {
      // Invalid referer URL
    }
  }

  // Check if domain is allowed
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Domain not authorized for form submissions'
    });
  }

  next();
};

// Middleware
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests) for development
    if (!origin) return callback(null, true);
    
    try {
      const hostname = new URL(origin).hostname;
      if (ALLOWED_DOMAINS.includes(hostname)) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid origin URL
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));

// Route to handle form submission
app.post('/gpu-requests', validateDomain, async (req, res) => {
  try {
    const { firstName, lastName, email, gpuType, quantity, message } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !gpuType || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, gpuType, and quantity are required'
      });
    }

    // Create new page in Notion database
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_DATABASE_ID,
      },
      properties: {
        'First name': {
          title: [
            {
              text: {
                content: firstName,
              },
            },
          ],
        },
        'Last name': {
          rich_text: [
            {
              text: {
                content: lastName,
              },
            },
          ],
        },
        'Email': {
          email: email,
        },
        'GPU type': {
          select: {
            name: gpuType,
          },
        },
        'Quantity': {
          number: parseInt(quantity),
        },
        'Message': {
          rich_text: [
            {
              text: {
                content: message || '',
              },
            },
          ],
        },
        'Submission time': {
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    console.log('Successfully created Notion page:', response.id);

    res.status(200).json({
      success: true,
      message: 'Form submitted successfully',
      notionPageId: response.id
    });

  } catch (error) {
    console.error('Error creating Notion page:', error);
    
    // Handle specific Notion API errors
    if (error.code === 'object_not_found') {
      return res.status(400).json({
        success: false,
        error: 'Notion database not found. Please check your database ID.'
      });
    }
    
    if (error.code === 'unauthorized') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized access to Notion. Please check your integration token.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error while submitting to Notion'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

module.exports = app;