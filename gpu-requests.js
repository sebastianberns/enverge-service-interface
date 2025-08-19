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

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Route to handle form submission
app.post('/submit-form', async (req, res) => {
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
        'First Name': {
          title: [
            {
              text: {
                content: firstName,
              },
            },
          ],
        },
        'Last Name': {
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
        'GPU Type': {
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
        'Submission Date': {
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