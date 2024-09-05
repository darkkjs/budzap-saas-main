// routes/chatCleanupRoutes.js

const express = require('express');
const router = express.Router();
const { cleanupChatsForInstance } = require('../services/chatCleanup');
//const { authenticateUser, isAdmin } = require('../middleware/auth'); // Assume you have authentication middleware

// Route to cleanup chats for a specific instance
router.post('/cleanup/:instanceKey', async (req, res) => {
    const { instanceKey } = req.params;

    try {
        const result = await cleanupChatsForInstance(instanceKey);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            message: `Successfully deleted ${result.deletedCount} chats for instance ${instanceKey}`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error in chat cleanup route:', error);
        res.status(500).json({ error: 'An error occurred while cleaning up chats' });
    }
});

module.exports = router;