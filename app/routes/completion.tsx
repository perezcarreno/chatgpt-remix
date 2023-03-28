import { LoaderArgs } from "@remix-run/node";
import { eventStream } from "remix-utils";
import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import { requireUserId } from "~/session.server";
import {
  getLastMessage,
  getMessageListItems,
  createMessage,
  Message,
} from "~/models/message.server";
const { Tiktoken } = require("@dqbd/tiktoken/lite");
import { json } from "@remix-run/node"; // or cloudflare/deno
const cl100k_base = require("@dqbd/tiktoken/encoders/cl100k_base.json");

let openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

let assistantMessageId = "";
let assistantFullMessage = "";
let userId = "";
let conversationId = "";
let lastMessageId = "";

/**
 * ChatGPT Related Variables
 */
const startToken = "||>";
const endToken = "";
const userLabel = "User"; //TODO: Grab these from a settings file
const chatGptLabel = "ChatGPT";
const maxContextTokens = 4095;
let maxResponseTokens = 1024;
const maxPromptTokens = maxContextTokens - maxResponseTokens;
interface message {
  role: string;
  name?: string;
  content: string;
}

let processData = async function (
  data: { toString: () => string },
  send: Function
) {
  const lines = data
    .toString()
    .split("\n")
    .filter((line: string) => line.trim() !== "");

  for (const line of lines) {
    const message = line.toString().replace(/^data: /, "");
    // If the stream is done, create the message in the db
    if (message === "[DONE]") {
      // Create messages in the database
      await createMessage({
        id: assistantMessageId,
        role: "assistant",
        content: assistantFullMessage,
        userId,
        conversationId,
      });

      // Let the client know the stream is done
      send({ event: "message", data: "[DONE]" });

      return; // Stream finished
    }
    try {
      const parsed = JSON.parse(message);
      // Get the message id from the assistant's response (only once)
      if (!assistantMessageId) {
        assistantMessageId = parsed.id;
      }

      // Get the content of each message
      let delta = parsed.choices[0].delta?.content;

      if (delta) {
        send({ event: "message", data: delta });

        // Concatenate the response to the full message
        assistantFullMessage += delta;
      }
    } catch (error) {
      console.error("Could not JSON parse stream message", message, error);
    }
  }
};

/**
 * Loader function for the completion route
 * @param param0
 * @returns
 */
export async function loader({ request }: LoaderArgs) {
  userId = await requireUserId(request);

  conversationId =
    new URL(request.url).searchParams.get("conversationId") || "";

  if (!conversationId) {
    return json("Invalid request. No Conversation provided.", { status: 404 });
  }

  console.log(
    `Completion called for conversation: ${conversationId} from user: ${userId}`
  );

  // Get last message from conversation
  const lastMessage: Message | null = await getLastMessage(
    { userId },
    { conversationId }
  );

  lastMessageId = lastMessage?.id || "";

  if (maxPromptTokens + maxResponseTokens > maxContextTokens) {
    throw new Error(
      `maxPromptTokens + max_tokens (${maxPromptTokens} + ${maxResponseTokens} = ${
        maxPromptTokens + maxResponseTokens
      }) must be less than or equal to maxContextTokens (${maxContextTokens})`
    );
  }

  const messages: message[] = [];

  const previousMessages = await getMessageListItems(
    { userId },
    { conversationId: conversationId }
  );

  const currentDateString = new Date().toLocaleDateString("en-us", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let systemMessage = `You are ChatGPT, a large language model trained by OpenAI. Respond conversationally.\nCurrent date: ${currentDateString}${endToken}\n\n`;

  const instructionsPayload = {
    role: "system",
    content: systemMessage,
  };

  // Add the instructions to the system message (first message in the array)
  messages.push(instructionsPayload);

  let currentTokenCount = getTokenCountForMessage(instructionsPayload);

  const maxTokenCount = maxPromptTokens;

  // Iterate backwards through the messages, adding them to the prompt until we reach the max token count.
  // Do this within a recursive async function so that it doesn't block the event loop for too long.
  const buildPromptBody = async (): Promise<boolean> => {
    if (currentTokenCount < maxTokenCount && previousMessages.length > 0) {
      const message = previousMessages.pop();
      if (message) {
        messages.push({
          role: message.role,
          name: userId,
          content: message.content,
        });

        const roleLabel = message.role === "user" ? userLabel : chatGptLabel;
        const messageString = `${startToken}${roleLabel}:\n${message.content}${endToken}\n`;

        const tokenCountForMessage = getTokenCount(messageString);
        const newTokenCount = currentTokenCount + tokenCountForMessage;
        if (newTokenCount > maxTokenCount) {
          if (messages.length > 1) {
            // This message would put us over the token limit, so don't add it.
            return false;
          }
          // This is the first message, so we can't add it. Just throw an error.
          throw new Error(
            `Prompt is too long. Max token count is ${maxTokenCount}, but prompt is ${newTokenCount} tokens long.`
          );
        }
        currentTokenCount = newTokenCount;
      }
      // wait for next tick to avoid blocking the event loop
      await new Promise((resolve) => setTimeout(resolve, 0));
      return buildPromptBody();
    }
    return true;
  };

  await buildPromptBody();

  // Add 2 tokens for metadata after all messages have been counted.
  currentTokenCount += 2;

  // Use up to `this.maxContextTokens` tokens (prompt + response), but try to leave `this.maxTokens` tokens for the response.
  maxResponseTokens = Math.min(
    maxContextTokens - currentTokenCount,
    maxResponseTokens
  );
  console.log("maxResponseTokens", maxResponseTokens);
  console.log("current token count", currentTokenCount);

  //console.log("---- Messages: ", messages);

  let response = await openai.createChatCompletion(
    {
      model: "gpt-3.5-turbo",
      messages: messages as ChatCompletionRequestMessage[],
      temperature: 0,
      max_tokens: 1024,
      stream: true,
    },
    { responseType: "stream" }
  );

  return eventStream(request.signal, function setup(send) {
    response.data.on("data", (data: any) => {
      processData(data, send);
    });

    return function clear() {};
  });
}

function getTokenCount(text: String) {
  const encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );
  const tokens = encoding.encode(text, "all");
  encoding.free();
  return tokens.length;
}

/**
 * Algorithm adapted from "6. Counting tokens for chat API calls" of
 * https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
 *
 * An additional 2 tokens need to be added for metadata after all messages have been counted.
 *
 * @param {*} message
 */
function getTokenCountForMessage(message: message) {
  // Map each property of the message to the number of tokens it contains
  const propertyTokenCounts = Object.entries(message).map(([key, value]) => {
    // Count the number of tokens in the property value
    const numTokens = getTokenCount(value);

    // Subtract 1 token if the property key is 'name'
    const adjustment = key === "name" ? 1 : 0;
    return numTokens - adjustment;
  });

  // Sum the number of tokens in all properties and add 4 for metadata
  return propertyTokenCounts.reduce((a, b) => a + b, 4);
}
