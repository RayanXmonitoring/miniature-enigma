const express = require('express');
const router = express.Router();
const memberManager = require('../telegram/memberManager');
const logger = require('../utils/logger');
const validator = require('../utils/validator');

// Middleware untuk autentikasi
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key',
    });
  }
  next();
};

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Get group info
router.get('/group/:groupId', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const info = await memberManager.getGroupInfo(parseInt(groupId));
    
    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    logger.error('Error getting group info:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get members from group
router.get('/members/:groupId', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 1000 } = req.query;
    
    const members = await memberManager.getGroupMembers(parseInt(groupId));
    
    // Apply limit if specified
    const data = limit > 0 ? members.slice(0, parseInt(limit)) : members;
    
    res.json({
      success: true,
      data,
      total: members.length,
      returned: data.length,
    });
  } catch (error) {
    logger.error('Error getting members:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Move members
router.post('/move', authenticate, async (req, res) => {
  try {
    const {
      sourceGroupId = process.env.SOURCE_GROUP_ID,
      destGroupId = process.env.DEST_GROUP_ID,
      batchSize = 100,
      delay = 2000,
      limit = 0,
      filter = null,
    } = req.body;

    // Validate group IDs
    if (!sourceGroupId || !destGroupId) {
      return res.status(400).json({
        success: false,
        message: 'sourceGroupId and destGroupId are required',
      });
    }

    // Parse filter if provided
    let filterFn = null;
    if (filter) {
      try {
        // Filter can be a function string or object
        // For safety, we'll only support simple filters
        filterFn = (member) => {
          // Example: filter by username contains 'user'
          if (filter.username) {
            return member.username?.includes(filter.username);
          }
          if (filter.exclude) {
            return !filter.exclude.includes(member.id);
          }
          return true;
        };
      } catch (error) {
        logger.error('Invalid filter:', error);
      }
    }

    // Start move process
    const result = await memberManager.moveMembers(
      parseInt(sourceGroupId),
      parseInt(destGroupId),
      {
        batchSize: parseInt(batchSize),
        delay: parseInt(delay),
        filterFn,
        limit: parseInt(limit),
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Move completed successfully',
    });
  } catch (error) {
    logger.error('Error moving members:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Move members with progress tracking (long running)
router.post('/move/async', authenticate, async (req, res) => {
  try {
    const {
      sourceGroupId = process.env.SOURCE_GROUP_ID,
      destGroupId = process.env.DEST_GROUP_ID,
      batchSize = 50,
      delay = 1000,
    } = req.body;

    // Return task ID immediately
    const taskId = Date.now().toString();
    
    // Process in background (not recommended for Railway, use queues instead)
    // For simplicity, we'll process synchronously here
    
    const result = await memberManager.moveMembers(
      parseInt(sourceGroupId),
      parseInt(destGroupId),
      {
        batchSize: parseInt(batchSize),
        delay: parseInt(delay),
      }
    );

    res.json({
      success: true,
      taskId,
      data: result,
    });
  } catch (error) {
    logger.error('Error in async move:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Leave group
router.post('/leave/:groupId', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const result = await memberManager.leaveGroup(parseInt(groupId));
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error leaving group:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const me = await memberManager.getMe();
    res.json({
      success: true,
      data: {
        id: me.id,
        username: me.username,
        firstName: me.firstName,
        lastName: me.lastName,
        phone: me.phone,
      },
    });
  } catch (error) {
    logger.error('Error getting user info:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
