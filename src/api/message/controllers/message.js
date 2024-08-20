// @ts-nocheck
"use strict";

/**
 * message controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::message.message", ({ strapi }) => ({
  async create(ctx) {
    const userId = ctx.state.user.id; // Get the authenticated user's ID
    const { content, conversation: conversationRefId } = ctx.request.body.data;
    const trimmedContent = content.trim();

    if (!trimmedContent || !trimmedContent.length === 0 || !conversationRefId) {
      return ctx.badRequest("Content and conversation refId are required.");
    }

    // Find the conversation and check if the user is a participant
    const conversations = await strapi.entityService.findMany(
      "api::conversation.conversation",
      {
        filters: { refId: conversationRefId },
        populate: ["participants"],
      }
    );

    if (conversations.length === 0) {
      return ctx.notFound("Conversation not found.");
    }

    const conversation = conversations[0];

    const isParticipant = conversation.participants.some(
      (participant) => participant.id === userId
    );

    if (!isParticipant) {
      return ctx.forbidden(
        "You are not allowed to create a message in this conversation."
      );
    }

    // If the user is a participant, proceed with creating the message
    ctx.request.body.data.sender = userId; // Ensure the sender is set to the authenticated user
    ctx.request.body.data.conversation = conversation.id;
    ctx.request.body.data.content = trimmedContent;

    return await super.create(ctx);
  },

  async find(ctx) {
    const userId = ctx.state.user.id; // Get the authenticated user's ID

    // Find conversations where the user is a participant
    const conversations = await strapi.entityService.findMany(
      "api::conversation.conversation",
      {
        filters: {
          participants: userId,
        },
        populate: ["messages"],
      }
    );

    // Extract message IDs from these conversations
    const conversationIds = conversations.map((convo) => convo.id);

    const refId = ctx.query.filters.conversation.refId;

    if (conversations.find((convo) => convo.refId === refId) === null) {
      return ctx.forbidden(
        "You are not allowed to get messages from this conversation."
      );
    }

    // Modify the query to only return messages within the allowed conversations
    ctx.query.filters = {
      $and: [
        ctx.query.filters,
        {
          conversation: { $in: conversationIds },
        },
      ],
    };

    return await super.find(ctx);
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user.id;

    // Get the message with the associated conversation and participants
    const message = await strapi.entityService.findOne(
      "api::message.message",
      id,
      {
        populate: {
          conversation: {
            populate: ["participants"],
          },
        },
      }
    );

    if (!message) {
      return ctx.notFound("Message not found.");
    }

    // Check if the user is part of the conversation
    const isParticipant = message.conversation.participants.some(
      (participant) => participant.id === userId
    );

    if (!isParticipant) {
      return ctx.unauthorized("You are not allowed to view this message.");
    }

    return message;
  },
}));
