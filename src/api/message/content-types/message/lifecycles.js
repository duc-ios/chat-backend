const { getSocket, socketUsers } = require("../../../../../socket");

module.exports = {
  async afterCreate(event) {
    const { result } = event;

    const message = await strapi.entityService.findOne(
      "api::message.message",
      result.id,
      {
        populate: {
          sender: { fields: [] },
          conversation: { fields: ["refId"], populate: ["participants"] },
        },
      }
    );

    // Access the Socket.IO instance
    const io = getSocket();

    if (io && message) {
      // Emit the 'message:create' event after a message is created

      const participants = message.conversation.participants.map(
        (participant) => participant.id
      );
      delete message.conversation.participants;

      strapi.log.debug(`[message:create] message: ${JSON.stringify(message)}`);
      strapi.log.debug(
        `[message:create] participants: ${JSON.stringify(participants)}`
      );
      strapi.log.debug(
        `[message:create] socketUsers: ${JSON.stringify(
          socketUsers.map((user) => {
            return { id: user.id, usename: user.username };
          })
        )}`
      );
      const filteredSocketUser = socketUsers.filter((socketUser) =>
        participants.includes(socketUser.id)
      );
      for (let idx in filteredSocketUser) {
        const socketUser = filteredSocketUser[idx];
        // Include the created message data
        io.to(socketUser.socketId).emit(`message:create`, message);
        strapi.log.debug(
          `[message:create] sent to socketUser: ${JSON.stringify({
            id: socketUser.id,
            username: socketUser.username,
          })}`
        );
      }
    }
  },
};
