const socketIo = require("socket.io");

let io;

var socketUsers = [];

function addUser(newUser) {
  socketUsers = socketUsers.filter(
    (socketUser) => socketUser.id !== newUser.id
  );
  socketUsers.push(newUser);
  for (let idx in socketUsers) {
    io.to(socketUsers[idx].socketId).emit("users", socketUsers);
  }
}

function removeUser(socketId) {
  socketUsers = socketUsers.filter((user) => user.socketId !== socketId);
  for (let idx in socketUsers) {
    io.to(socketUsers[idx].socketId).emit("users", socketUsers);
  }
}

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

const getSocket = () => io;

const getSocketUsers = () => socketUsers;

module.exports = { initSocket, getSocket, getSocketUsers };
