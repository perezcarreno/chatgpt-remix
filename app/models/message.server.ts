import type { User, Conversation, Message } from "@prisma/client";

import { prisma } from "~/db.server";

export type { Message } from "@prisma/client";

export function getMessage({
  id,
  userId,
  conversationId,
}: Pick<Message, "id" | "content" | "role"> & {
  userId: User["id"];
} & {
  conversationId: Conversation["id"];
}) {
  return prisma.message.findFirst({
    select: { id: true, content: true, role: true },
    where: { id, userId, conversationId },
  });
}

export function getLastMessage(
  { userId }: { userId: User["id"] },
  { conversationId }: { conversationId: Conversation["id"] }
) {
  return prisma.message.findFirst({
    where: { userId, conversationId },
    orderBy: { createdAt: "desc" },
  });
}

export function getMessageListItems(
  { userId }: { userId: User["id"] },
  { conversationId }: { conversationId: Conversation["id"] }
) {
  return prisma.message.findMany({
    where: { userId, conversationId },
    select: { id: true, content: true, role: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function createMessage({
  id,
  content,
  role,
  userId,
  conversationId,
}: Pick<Message, "id" | "content" | "role"> & {
  userId: User["id"];
} & {
  conversationId: Conversation["id"];
}) {
  return prisma.message.create({
    data: {
      id,
      content,
      role,
      user: {
        connect: {
          id: userId,
        },
      },
      conversation: {
        connect: {
          id: conversationId,
        },
      },
    },
  });
}

export function deleteMessage({
  id,
  userId,
}: Pick<Message, "id"> & { userId: User["id"] }) {
  return prisma.message.deleteMany({
    where: { id, userId },
  });
}
