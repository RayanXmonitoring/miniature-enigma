const { getClient, getGroupIdFromUsername, getGroupInfoByUsername } = require('./client');
const logger = require('../utils/logger');

class MemberManager {
  constructor() {
    this.batchSize = 100;
    this.delayBetweenBatches = 2000;
  }

  // Fungsi untuk mendapatkan member dari username grup
  async getGroupMembersByUsername(username) {
    try {
      const groupInfo = await getGroupIdFromUsername(username);
      return await this.getGroupMembers(groupInfo.id);
    } catch (error) {
      logger.error(`Error getting members from group ${username}:`, error);
      throw error;
    }
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
            phone: p.phone || '',
          }));

          result.push(...members);
          offset += limit;

          if (participants.participants.length < limit) {
            break;
          }

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

  async addMemberToGroupByUsername(userId, groupUsername, accessHash = null) {
    try {
      const groupInfo = await getGroupIdFromUsername(groupUsername);
      return await this.addMemberToGroup(userId, groupInfo.id, accessHash);
    } catch (error) {
      logger.error(`Failed to add user to group ${groupUsername}:`, error);
      throw error;
    }
  }

  async addMemberToGroup(userId, groupId, accessHash = null) {
    try {
      const client = await getClient();

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
      
      if (error.errorMessage?.includes('USER_ALREADY_PARTICIPANT')) {
        return { success: true, userId, message: 'Already in group' };
      }
      
      return { success: false, userId, error: error.errorMessage || error.message };
    }
  }

  async moveMembersByUsername(fromUsername, toUsername, options = {}) {
    const {
      batchSize = this.batchSize,
      delay = this.delayBetweenBatches,
      filterFn = null,
      limit = null,
    } = options;

    logger.info(`Starting member move from @${fromUsername} to @${toUsername}`);

    try {
      // Dapatkan info kedua grup
      const fromGroupInfo = await getGroupInfoByUsername(fromUsername);
      const toGroupInfo = await getGroupInfoByUsername(toUsername);

      logger.info(`Source group: ${fromGroupInfo.title} (${fromGroupInfo.membersCount} members)`);
      logger.info(`Destination group: ${toGroupInfo.title}`);

      // Get all members from source group
      const members = await this.getGroupMembers(fromGroupInfo.id);
      
      if (members.length === 0) {
        logger.warn('No members found in source group');
        return {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0,
          results: [],
          fromGroup: fromGroupInfo,
          toGroup: toGroupInfo,
        };
      }

      // Apply filter if provided
      let filteredMembers = members;
      if (filterFn) {
        filteredMembers = members.filter(filterFn);
        logger.info(`Filtered ${members.length - filteredMembers.length} members`);
      }

      if (limit && limit > 0) {
        filteredMembers = filteredMembers.slice(0, limit);
      }

      const results = [];
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // Proses dalam batch
      for (let i = 0; i < filteredMembers.length; i += batchSize) {
        const batch = filteredMembers.slice(i, i + batchSize);
        
        logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filteredMembers.length/batchSize)}`);

        const batchPromises = batch.map(async (member) => {
          // Skip bots
          if (member.id.toString().startsWith('bot') || member.id.toString().startsWith('Bot')) {
            skippedCount++;
            return {
              userId: member.id,
              username: member.username,
              firstName: member.firstName,
              success: false,
              skipped: true,
              reason: 'Is bot',
            };
          }

          // Skip self
          const me = await this.getMe();
          if (member.id === me.id) {
            skippedCount++;
            return {
              userId: member.id,
              username: member.username,
              firstName: member.firstName,
              success: false,
              skipped: true,
              reason: 'Is self',
            };
          }

          const result = await this.addMemberToGroup(
            member.id,
            toGroupInfo.id,
            member.accessHash
          );

          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }

          return {
            userId: member.id,
            username: member.username || 'No username',
            firstName: member.firstName || '',
            lastName: member.lastName || '',
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
              userId: 'unknown',
              success: false,
              error: result.reason?.message || 'Unknown error',
            });
          }
        });

        if (i + batchSize < filteredMembers.length) {
          await this.delay(delay);
        }
      }

      const summary = {
        total: filteredMembers.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        successRate: filteredMembers.length > 0 
          ? `${((successCount / filteredMembers.length) * 100).toFixed(2)}%` 
          : '0%',
        results,
        fromGroup: fromGroupInfo,
        toGroup: toGroupInfo,
        timestamp: new Date().toISOString(),
      };

      logger.info(`Member move completed. Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);
      
      return summary;
    } catch (error) {
      logger.error(`Error moving members from @${fromUsername} to @${toUsername}:`, error);
      throw error;
    }
  }

  async getMe() {
    const client = await getClient();
    const me = await client.getMe();
    return me;
  }

  async leaveGroupByUsername(username) {
    try {
      const groupInfo = await getGroupIdFromUsername(username);
      return await this.leaveGroup(groupInfo.id);
    } catch (error) {
      logger.error(`Failed to leave group @${username}:`, error);
      throw error;
    }
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

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new MemberManager();
