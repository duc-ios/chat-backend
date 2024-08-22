const socketIo = require("socket.io");

let io;

var socketUsers = [];

const getSocket = () => io;

const getSocketUsers = () => socketUsers;

const addUser = (newUser) => {
  socketUsers = socketUsers.filter(
    (socketUser) => socketUser.id !== newUser.id
  );
  socketUsers.push(newUser);
  for (let idx in socketUsers) {
    io.to(socketUsers[idx].socketId).emit("users", socketUsers);
  }
};

const removeUser = (socketId) => {
  socketUsers = socketUsers.filter((user) => user.socketId !== socketId);
  for (let idx in socketUsers) {
    io.to(socketUsers[idx].socketId).emit("users", socketUsers);
  }
};

const sendEvent = async (event, messageId) => {
  const message = await strapi.entityService.findOne(
    "api::message.message",
    messageId,
    {
      populate: {
        sender: { fields: ["id", "username"] },
        conversation: { fields: ["refId"], populate: ["participants"] },
      },
    }
  );

  if (!message) {
    return;
  }

  const conversation = message.conversation;
  const participants = conversation.participants.map(
    (participant) => participant.id
  );
  delete message.conversation.participants;

  const socketUsers = getSocketUsers();

  strapi.log.debug(`[${event}] message: ${JSON.stringify(message)}`);
  strapi.log.debug(`[${event}] participants: ${JSON.stringify(participants)}`);
  strapi.log.debug(
    `[${event}] socketUsers: ${JSON.stringify(
      socketUsers.map((user) => {
        return { id: user.id, username: user.username };
      })
    )}`
  );
  const filteredSocketUser = socketUsers.filter((socketUser) =>
    participants.includes(socketUser.id)
  );
  for (let idx in filteredSocketUser) {
    const socketUser = filteredSocketUser[idx];
    // Include the created message data
    io.to(socketUser.socketId).emit(event, message);
    strapi.log.debug(
      `[${event}] sent to socketUser: ${JSON.stringify({
        id: socketUser.id,
        username: socketUser.username,
      })}`
    );
  }
};

const initSocket = (strapi) => {
  strapi.log.debug("[io] initSocket");

  // @ts-ignore
  io = socketIo(strapi.server.httpServer);

  io.on("connection", async (socket) => {
    // Authenticate the user when connecting
    strapi.log.debug("[io] User connecting");
    const token = socket.handshake.auth.token;

    if (!token) {
      strapi.log.debug("[io] No token provided");
      socket.disconnect();
      return;
    }

    // Decode the JWT token
    try {
      const decoded = await strapi.plugins[
        "users-permissions"
      ].services.jwt.verify(token);
      strapi.log.debug(`[io] Decoded token ${JSON.stringify(decoded)}`);
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        decoded.id,
        { fields: ["username"], populate: ["avatar"] }
      );
      if (user) {
        user.socketId = socket.id;
        socket.id = user.id;
        addUser(user);
        strapi.log.debug(
          `[io] Users connected: ${JSON.stringify(
            socketUsers.map((user) => {
              return {
                id: user.id,
                socketId: user.socketId,
                usename: user.username,
              };
            }),
            null,
            2
          )}`
        );
      } else {
        strapi.log.debug(`[io] User not found id: ${decoded.id}`);
        socket.disconnect();
      }
    } catch (err) {
      strapi.log.debug(`[io] Error decoding token ${err}`);
      socket.disconnect();
    }

    socket.on("disconnect", () => {
      removeUser(socket.socketId);
      strapi.log.debug("[io] User disconnected");
    });
  });
};

module.exports = { initSocket, getSocket, getSocketUsers, sendEvent };
