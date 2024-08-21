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

      const { query: query } = ctx.request;
      const { filters: queryFilters } = query;

      if (queryFilters) {
        // @ts-ignore
        queryFilters.participants = {
          $in: sender.id,
        };
      } else {
        ctx.request.query.filters = {
          // @ts-ignore
          participants: {
            $in: sender.id,
          },
        };
      }
      const populate = ctx.request.query.populate;
      if (populate) {
        // @ts-ignore
        populate.participants = {
          // @ts-ignore
          populate: ["avatar"],
        // @ts-ignore
        };
      } else {
        ctx.request.query.populate = {
          // @ts-ignore
          participants: {
            populate: ["avatar"],
          },
        };
      }

      var response = await super.find(ctx);
      const data = response.data;
      if (data) {
        for (let idx in data) {
          var conversation = data[idx];
          const messages = await strapi.entityService.findMany(
            "api::message.message",
            {
              limit: 1,
              filters: { conversation: conversation.id },
              sort: ["createdAt:desc"],
            }
          );
          if (messages.length > 0) {
            conversation.attributes.lastMessage = messages[0];
          }
          const participants = conversation.attributes.participants;
          if (participants) {
            const participantsData = participants.data;
            for (let idx in participantsData) {
              const participant = participantsData[idx];
              participant.attributes.avatar =
                participant.attributes.avatar.data.attributes.formats.thumbnail.url;
            }
          }
        }
      }
      return response;
    },
  })
);
