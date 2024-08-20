"use strict";

/**
 * conversation controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::conversation.conversation",
  ({ strapi }) => ({
    async find(ctx) {
      const filters = ctx.query.filters;
      const sender = ctx.state.user;

      if (filters !== undefined) {
        const recipentId = ctx.query["filters"]["recipentId"];

        if (recipentId) {
          if (recipentId === "") {
            return ctx.badRequest("Recipent id cannot be empty");
          }

          const recipent = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            recipentId
          );

          if (recipent === null) {
            return ctx.notFound("Recipent not found.");
          }

          const refId = [sender.id, recipent.id].sort().join("_");

          const conversations = await strapi.entityService.findMany(
            "api::conversation.conversation",
            {
              filters: { refId: `${refId}` },
            }
          );

          if (conversations.length === 0) {
            const conversation = await strapi.entityService.create(
              "api::conversation.conversation",
              {
                data: {
                  refId: refId,
                  name: `${sender.username} and ${recipent.username}`,
                  participants: {
                    connect: [sender.id, recipent.id],
                  },
                },
              }
            );

            return {
              data: [conversation],
            };
          } else {
            return { data: conversations };
          }
        }
      }

      return await super.find(ctx);
    },
  })
);
