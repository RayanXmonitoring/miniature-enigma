const express = require('express');
const router = express.Router();
const memberManager = require('../telegram/memberManager');
const { getGroupInfoByUsername, getGroupIdFromUsername } = require('../telegram/client');
const logger = require('../utils/logger');

// Middleware autentikasi
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

// Get group info by username
router.get('/group/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    const info = await getGroupInfoByUsername(username);
    
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

// Get members from group by username
router.get('/members/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 1000 } = req.query;
    
    const members = await memberManager.getGroupMembersByUsername(username);
    
    const data = limit > 0 ? members.slice(0, parseInt(limit)) : members;
    
    res.json({
      success: true,
      data,
      total: members.length,
      returned: data.length,
      group: username,
    });
  } catch (error) {
    logger.error('Error getting members:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Move members using usernames
router.post('/move', authenticate, async (req, res) => {
  try {
    const {
      sourceUsername = process.env.SOURCE_GROUP_USERNAME,
      destUsername = process.env.DEST_GROUP_USERNAME,
      batchSize = 100,
      delay = 2000,
      limit = 0,
      filter = null,
    } = req.body;

    if (!sourceUsername || !destUsername) {
      return res.status(400).json({
        success: false,
        message: 'sourceUsername and destUsername are required',
      });
    }

    let filterFn = null;
    if (filter) {
      filterFn = (member) => {
        if (filter.username) {
          return member.username?.toLowerCase().includes(filter.username.toLowerCase());
        }
        if (filter.excludeUsernames) {
          const exclude = filter.excludeUsernames.map(u => u.toLowerCase());
          return !exclude.includes(member.username?.toLowerCase());
        }
        if (filter.excludeIds) {
          return !filter.excludeIds.includes(member.id);
        }
        return true;
      };
    }

    const result = await memberManager.moveMembersByUsername(
      sourceUsername,
      destUsername,
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

// Leave group by username
router.post('/leave/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    const result = await memberManager.leaveGroupByUsername(username);
    
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

// Preview members to be moved (dry run)
router.post('/preview', authenticate, async (req, res) => {
  try {
    const {
      sourceUsername = process.env.SOURCE_GROUP_USERNAME,
      limit = 10,
      filter = null,
    } = req.body;

    if (!sourceUsername) {
      return res.status(400).json({
        success: false,
        message: 'sourceUsername is required',
      });
    }

    let members = await memberManager.getGroupMembersByUsername(sourceUsername);
    
    if (filter) {
      const filterFn = (member) => {
        if (filter.username) {
          return member.username?.toLowerCase().includes(filter.username.toLowerCase());
        }
        if (filter.excludeUsernames) {
          const exclude = filter.excludeUsernames.map(u => u.toLowerCase());
          return !exclude.includes(member.username?.toLowerCase());
        }
        return true;
      };
      members = members.filter(filterFn);
    }

    const preview = members.slice(0, parseInt(limit)).map(m => ({
      id: m.id,
      username: m.username || 'No username',
      firstName: m.firstName || '',
      lastName: m.lastName || '',
    }));

    res.json({
      success: true,
      data: {
        total: members.length,
        preview: preview,
        limit: parseInt(limit),
        message: `Menampilkan ${Math.min(limit, members.length)} dari ${members.length} member`,
      },
    });
  } catch (error) {
    logger.error('Error previewing members:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
