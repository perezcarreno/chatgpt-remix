import { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node"; // or cloudflare/deno
import { requireUserId } from "~/session.server";
import { createMessage, getMessageListItems } from "~/models/message.server";
import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
import { Readable } from "stream";
import cuid from "cuid";
const { Tiktoken } = require("@dqbd/tiktoken/lite");

const cl100k_base = require("@dqbd/tiktoken/encoders/cl100k_base.json");

let openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

/**
 * ChatGPT Related Variables
 */
const maxContextTokens = 4095;
let maxResponseTokens = 1024;
const maxPromptTokens = maxContextTokens - maxResponseTokens;

// Create a string to hold the full message from the assistant
let assistantFullMessage = "";

/**
 * Message interface
 */
interface message {
  role: string;
  content: string;
}

/**
 *
 * @param data
 * @param send
 * @returns
 */
let streamCompletion = async function (
  data: { toString: () => string },
  userId: string,
  conversationId: string,
  send: Function
) {
  // Split the data into lines
  const lines = data
    .toString()
    .split("\n")
    .filter((line: string) => line.trim() !== "");

  // Go through each line
  for (const line of lines) {
    const message = line.toString().replace(/^data: /, "");

    // If the stream is done, create the message in the db
    if (message === "[DONE]") {
      // Create messages in the database
      await createMessage({
        id: cuid(),
        role: "assistant",
        content: assistantFullMessage,
        userId,
        conversationId,
      });

      // Let the client know the stream is done
      send({ event: "message", data: "[DONE]" });
      // Clear the assistantFullMessage
      assistantFullMessage = "";
      console.log("Stream finished");

      return; // Stream finished
    } else {
      try {
        const parsed = JSON.parse(message);

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
  }
};

/**
 * Loader function for the completion route
 * @param param0
 * @returns
 */
export async function loader({ request }: LoaderArgs) {
  let userId = await requireUserId(request);

  let conversationId =
    new URL(request.url).searchParams.get("conversationId") || "";

  if (!conversationId) {
    return json("Invalid request. No Conversation provided.", {
      status: 404,
    });
  }

  // Get the all messages in this conversation
  const previousMessages = await getMessageListItems(
    { userId },
    { conversationId: conversationId }
  );

  // Only keep the properties needed by OpenAI
  let simplifiedPreviousMessages: message[] = previousMessages
    .slice()
    .reverse()
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
  const messages: message[] = [];

  console.log(
    `Completion called for conversation: ${conversationId} from user: ${userId}`
  );

  // Create a system message with the current date
  const currentDateString = new Date().toLocaleDateString("en-us", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  let systemMessage = `You are ChatGPT, a large language model trained by OpenAI. Respond conversationally.\nCurrent date: ${currentDateString}\n`;

  // Create a system message payload
  const instructionsPayload = {
    role: "system",
    content: systemMessage,
  };

  // Add the token count for the instructions to the current token count
  let currentTokenCount = getTokenCountForMessage(instructionsPayload);

  // Reverse the previousMessages array so that the most recent messages are processed first
  const reversedPreviousMessages = simplifiedPreviousMessages.slice().reverse();

  // Go through all the reversedPreviousMessages and add them to the messages array, by first counting the tokens of each message and checking to see if the current token count + the token count of the message is less than the max context tokens. If it is, add the message to the messages array and add the token count to the current token count. If it is not, stop adding messages to the messages array.
  for (const prevMessage of reversedPreviousMessages) {
    const messageTokenCount = getTokenCountForMessage(prevMessage);

    if (currentTokenCount + messageTokenCount < maxPromptTokens) {
      messages.unshift(prevMessage);
      currentTokenCount += messageTokenCount;
    } else {
      break;
    }
  }

  // Add the instructions to the system message (first message in the array)
  messages.unshift(instructionsPayload);

  // Add 2 tokens for metadata after all messages have been counted.
  currentTokenCount += 2;

  // Use up to `this.maxContextTokens` tokens (prompt + response), but try to leave `this.maxTokens` tokens for the response.
  maxResponseTokens = Math.min(
    maxContextTokens - currentTokenCount,
    maxResponseTokens
  );

  console.log("Messages to send to OpenAI:", messages);

  interface OpenAIReadable extends Readable {}

  try {
    const response = await openai.createChatCompletion(
      {
        model: "gpt-3.5-turbo",
        messages: messages as ChatCompletionRequestMessage[],
        max_tokens: 1024,
        temperature: 0,
        stream: true,
      },
      { responseType: "stream" }
    );

    return eventStream(request.signal, function setup(send) {
      const dataStream = response.data as unknown as OpenAIReadable;
      dataStream.on("data", (data: any) => {
        streamCompletion(data, userId, conversationId, send);
      });

      return function clear() {};
    });
  } catch (error) {
    console.error(error);
    return json(error, { status: 500 });
  }
}

interface SendFunctionArgs {
  /**
   * @default "message"
   */
  event?: string;
  data: string;
}

interface SendFunction {
  (args: SendFunctionArgs): void;
}

interface CleanupFunction {
  (): void;
}

interface InitFunction {
  (send: SendFunction): CleanupFunction;
}

/**
 * A response holper to use Server Sent Events server-side
 * @param signal The AbortSignal used to close the stream
 * @param init The function that will be called to initialize the stream, here you can subscribe to your events
 * @returns A Response object that can be returned from a loader
 */
function eventStream(signal: AbortSignal, init: InitFunction) {
  let stream = new ReadableStream({
    start(controller) {
      let encoder = new TextEncoder();

      function send({ event = "message", data }: SendFunctionArgs) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      let cleanup = init(send);

      let closed = false;

      function close() {
        if (closed) return;
        cleanup();
        closed = true;
        signal.removeEventListener("abort", close);
        controller.close();
      }

      signal.addEventListener("abort", close);

      if (signal.aborted) return close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Algorithm adapted from "6. Counting tokens for chat API calls" of
 * https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
 *
 * Note: An additional 2 tokens need to be added for metadata after all messages have been counted.
 *
 * @param {*} message
 */
function getTokenCountForMessage(message: message) {
  // Create a Tiktoken instance
  const encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );

  // Map each property of the message to the number of tokens it contains
  const propertyTokenCounts = Object.entries(message).map(([key, value]) => {
    // Count the number of tokens in the property value
    const tokens = encoding.encode(value, "all");

    // Get the number of tokens
    const numTokens = tokens.length;

    // Subtract 1 token if the property key is 'name'
    const adjustment = key === "name" ? 1 : 0;
    return numTokens - adjustment;
  });

  // Free the encoding instance
  encoding.free();

  // Sum the number of tokens in all properties and add 4 for metadata
  return propertyTokenCounts.reduce((a, b) => a + b, 4);
}
