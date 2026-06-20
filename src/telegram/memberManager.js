const { getClient } = require('./client');
const logger = require('../utils/logger');

class MemberManager {
  constructor() {
    this.batchSize = 100;
    this.delayBetweenBatches = 2000; // 2 seconds
  }

  async getGroupMembers(groupId) {
    try {
      const client = await getClient();
      const result = [];
      let offset = 0;
      const limit = 100;

      logger.info(`Fetching members from group: ${groupId}`);

      while (true) {
        try {
          const participants = await client.invoke(
            new client._raw.contacts.GetParticipants({
              group: new client._raw.InputPeerChat(groupId),
              offset: offset,
              limit: limit,
              hash: 0
            })
          );

          if (!participants || participants.participants.length === 0) {
            break;
          }

          const members = participants.participants.map(p => ({
            id: p.userId,
            username: p.username || '',
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            accessHash: p.accessHash || '',
          }));

          result.push(...members);
          offset += limit;

          if (participants.participants.length < limit) {
            break;
          }

          // Delay to avoid rate limiting
          await this.delay(500);
        } catch (error) {
          logger.error('Error fetching members batch:', error);
          break;
        }
      }

      logger.info(`Total members found: ${result.length}`);
      return result;
    } catch (error) {
      logger.error('Error getting group members:', error);
      throw error;
    }
  }

  async addMemberToGroup(userId, groupId, accessHash = null) {
    try {
      const client = await getClient();

      // Try to add member to group
      const result = await client.invoke(
        new client._raw.messages.AddChatUser({
          chatId: groupId,
          userId: new client._raw.InputUser({
            userId: userId,
            accessHash: accessHash || 0,
          }),
          fwdLimit: 50,
        })
      );

      logger.info(`Successfully added user ${userId} to group ${groupId}`);
      return { success: true, userId, groupId };
    } catch (error) {
      logger.error(`Failed to add user ${userId} to group ${groupId}:`, error);
      
      // Check if user is already in group or other errors
      if (error.errorMessage?.includes('USER_ALREADY_PARTICIPANT')) {
        return { success: true, userId, message: 'Already in group' };
      }
      
      return { success: false, userId, error: error.errorMessage || error.message };
    }
  }

  async moveMembers(fromGroupId, toGroupId, options = {}) {
    const {
      batchSize = this.batchSize,
      delay = this.delayBetweenBatches,
      filterFn = null,
      limit = null,
    } = options;

    logger.info(`Starting member move from ${fromGroupId} to ${toGroupId}`);

    // Get all members from source group
    const members = await this.getGroupMembers(fromGroupId);
    
    if (members.length === 0) {
      logger.warn('No members found in source group');
      return {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    // Apply filter if provided
    let filteredMembers = members;
    if (filterFn) {
      filteredMembers = members.filter(filterFn);
      logger.info(`Filtered ${members.length - filteredMembers.length} members`);
    }

    // Apply limit if provided
    if (limit && limit > 0) {
      filteredMembers = filteredMembers.slice(0, limit);
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process in batches
    for (let i = 0; i < filteredMembers.length; i += batchSize) {
      const batch = filteredMembers.slice(i, i + batchSize);
      
      logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filteredMembers.length/batchSize)}`);

      // Process each member in batch
      const batchPromises = batch.map(async (member) => {
        // Skip bots
        if (member.id.toString().startsWith('bot')) {
          skippedCount++;
          return {
            userId: member.id,
            success: false,
            skipped: true,
            reason: 'Is bot',
          };
        }

        // Skip self
        if (member.id === (await this.getMe()).id) {
          skippedCount++;
          return {
            userId: member.id,
            success: false,
            skipped: true,
            reason: 'Is self',
          };
        }

        const result = await this.addMemberToGroup(
          member.id,
          toGroupId,
          member.accessHash
        );

        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }

        return {
          userId: member.id,
          username: member.username,
          firstName: member.firstName,
          ...result,
        };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failedCount++;
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      });

      // Delay between batches
      if (i + batchSize < filteredMembers.length) {
        await this.delay(delay);
      }
    }

    logger.info(`Member move completed. Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);
    
    return {
      total: filteredMembers.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      results,
    };
  }

  async getMe() {
    const client = await getClient();
    const me = await client.getMe();
    return me;
  }

  async leaveGroup(groupId) {
    try {
      const client = await getClient();
      await client.invoke(
        new client._raw.messages.DeleteChatUser({
          chatId: groupId,
          userId: new client._raw.InputUserSelf(),
        })
      );
      logger.info(`Left group ${groupId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to leave group ${groupId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getGroupInfo(groupId) {
    try {
      const client = await getClient();
      const chat = await client.getChat(groupId);
      return {
        id: chat.id,
        title: chat.title,
        username: chat.username,
        membersCount: chat.participantsCount || 0,
        isGroup: chat.isGroup,
        isSupergroup: chat.isSupergroup,
      };
    } catch (error) {
      logger.error(`Failed to get group info ${groupId}:`, error);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new MemberManager();
