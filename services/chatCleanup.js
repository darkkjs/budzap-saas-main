// services/chatCleanup.js

const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');

/**
 * Cleans up all chats for a specific WhatsApp instance
 * @param {string} instanceKey - The key of the WhatsApp instance
 * @returns {Promise<{deletedCount: number, error: string|null}>}
 */
async function cleanupChatsForInstance(instanceKey) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find the user who owns the instance
        const user = await User.findOne({ 'whatsappInstances.name': instanceKey }).session(session);

        if (!user) {
            throw new Error('User or instance not found');
        }

        // Find the specific instance
        const instance = user.whatsappInstances.find(inst => inst.key === instanceKey);

        if (!instance) {
            throw new Error('Instance not found');
        }

        // Delete all chats for this instance
        const result = await Chat.deleteMany({ instanceKey }).session(session);

        // Reset autoResponseReports for this instance
        instance.autoResponseReports = [];

        // Reset autoResponseCount for the user
        user.autoResponseCount = 0;

        await user.save({ session });

        await session.commitTransaction();

        console.log(`Deleted ${result.deletedCount} chats for instance ${instanceKey}`);

        return {
            deletedCount: result.deletedCount,
            error: null
        };
    } catch (error) {
        await session.abortTransaction();
        console.error('Error cleaning up chats:', error);
        return {
            deletedCount: 0,
            error: error.message
        };
    } finally {
        session.endSession();
    }
}

module.exports = {
    cleanupChatsForInstance
};