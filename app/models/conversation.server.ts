import type { User, Conversation } from "@prisma/client";

import { prisma } from "~/db.server";

export type { Conversation } from "@prisma/client";

export function getConversation({
  id,
  userId,
}: Pick<Conversation, "id"> & {
  userId: User["id"];
}) {
  return prisma.conversation.findFirst({
    select: { id: true, title: true },
    where: { id, userId },
  });
}

export function getConversationListItems({ userId }: { userId: User["id"] }) {
  return prisma.conversation.findMany({
    where: { userId },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function createConversation({
  title,
  userId,
}: Pick<Conversation, "title"> & {
  userId: User["id"];
}) {
  return prisma.conversation.create({
    data: {
      title,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

export function deleteConversation({
  id,
  userId,
}: Pick<Conversation, "id"> & { userId: User["id"] }) {
  return prisma.conversation.deleteMany({
    where: { id, userId },
  });
}
