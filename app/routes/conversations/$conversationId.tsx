import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useLoaderData,
  useFetcher,
  useParams,
  useRevalidator,
} from "@remix-run/react";
import { useState, useEffect, useRef, SetStateAction } from "react";
import invariant from "tiny-invariant";
import {
  deleteConversation,
  getConversation,
} from "~/models/conversation.server";
import { getMessageListItems, createMessage } from "~/models/message.server";
import { requireUserId } from "~/session.server";
import ReactMarkdown from "react-markdown";
import cuid from "cuid";

export async function loader({ request, params }: LoaderArgs) {
  const userId = await requireUserId(request);
  invariant(params.conversationId, "conversationId not found");

  const conversation = await getConversation({
    userId,
    id: params.conversationId,
  });
  if (!conversation) {
    throw new Response("Not Found", { status: 404 });
  }

  const messageListItems = await getMessageListItems(
    { userId },
    { conversationId: conversation.id }
  );

  return json({ conversation, messageListItems });
}

export async function action({ request, params }: ActionArgs) {
  const userId = await requireUserId(request);
  invariant(params.conversationId, "conversationId not found");

  let formData = await request.formData();
  let { _action, text, ...values } = Object.fromEntries(formData);

  if (_action === "deleteConversation") {
    await deleteConversation({ userId, id: params.conversationId });

    return redirect("/conversations");
  }

  if (_action === "createMessage") {
    if (typeof text !== "string") {
      throw new Error("Invalid input type for text");
    }

    invariant(typeof text === "string", "text must be a string");

    const errors = {
      text: text ? null || text === "" : "Text is required",
    };
    const hasErrors = Object.values(errors).some(
      (errorMessage) => errorMessage
    );
    if (hasErrors) {
      return json(errors);
    }

    // Create user's message in the database

    await createMessage({
      userId,
      id: cuid(),
      conversationId: params.conversationId,
      role: "user",
      content: text,
    });

    return json({ createdMessage: true });
  }
}

export default function ConversationDetailsPage() {
  const data = useLoaderData<typeof loader>();

  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [data.messageListItems, newMessage]);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="flex h-full flex-col justify-between gap-2 ">
      <div className="header flex items-center justify-between p-2">
        <h3 className="text-md my-0 py-0 font-bold">
          {data.conversation.title}
        </h3>
        <Form method="post">
          <input type="hidden" name="id" value={data.conversation.id} />
          <button
            type="submit"
            name="_action"
            value="deleteConversation"
            className=" px-4 text-sm text-slate-400  underline hover:text-blue-400"
          >
            Delete
          </button>
        </Form>
      </div>
      <div className="messages h-full overflow-y-auto" ref={messagesRef}>
        {data.messageListItems.length === 0 ? (
          <p className="p-4">No messages yet. Write a new one below!</p>
        ) : (
          <div>
            {data.messageListItems
              .slice()
              .reverse()
              .map((message, index) => (
                <div
                  key={message.id}
                  className={`group w-full border-b border-black/10 text-gray-800 ${
                    message.role === "assistant" ? "bg-gray-100" : ""
                  }`}
                >
                  <div className="m-auto flex gap-4 p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                    <div className="relative flex w-[30px] flex-col items-end">
                      <div className="relative flex">
                        {message.role === "user" ? (
                          <div className="h-8 w-8 rounded-full bg-orange-300"></div>
                        ) : message.role === "assistant" ? (
                          <div className="h-8 w-8 rounded-full bg-blue-300"></div>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative flex w-[calc(100%-50px)] flex-col gap-1 md:gap-3 lg:w-[calc(100%-115px)]">
                      <div className="flex flex-grow flex-col gap-3">
                        <div className="flex min-h-[20px] flex-col items-start gap-4 whitespace-pre-wrap">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="visible mt-2 flex justify-center gap-3 self-end text-gray-400 md:gap-4 lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:translate-x-full lg:gap-1 lg:self-center lg:pl-2">
                        <button
                          className="rounded-md p-1 hover:bg-gray-100 hover:text-gray-700 md:invisible md:group-hover:visible"
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                          }}
                        >
                          📋
                        </button>
                      </div>
                      <div className="flex justify-between"></div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
        {newMessage !== "" ? (
          <div
            id="botResponse"
            className={`group w-full border-b border-black/10 bg-gray-300 text-gray-800`}
          >
            <div className="m-auto flex gap-4 p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
              <div className="relative flex w-[30px] flex-col items-end">
                <div className="relative flex">
                  <div className="h-8 w-8 rounded-full bg-blue-300"></div>
                </div>
              </div>
              <div className="relative flex w-[calc(100%-50px)] flex-col gap-1 md:gap-3 lg:w-[calc(100%-115px)]">
                <div className="flex flex-grow flex-col gap-3">
                  <div className="flex min-h-[20px] flex-col items-start gap-4 whitespace-pre-wrap">
                    <ReactMarkdown>{newMessage}</ReactMarkdown>
                  </div>
                </div>
                <div className="visible mt-2 flex justify-center gap-3 self-end text-gray-400 md:gap-4 lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:translate-x-full lg:gap-1 lg:self-center lg:pl-2"></div>
                <div className="flex justify-between"></div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <MessageInput newMessage={newMessage} setNewMessage={setNewMessage} />
    </div>
  );
}

function MessageInput(props: { newMessage: string; setNewMessage: Function }) {
  let messageFetcher = useFetcher();
  let revalidator = useRevalidator();

  const isSubmitting = Boolean(messageFetcher.state === "submitting");

  let messageFormRef = useRef<HTMLFormElement | null>(null);

  let { conversationId } = useParams();

  // State variable for text input
  const [text, setText] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // State variable for completion status
  const [isCompletionStreaming, setIsCompletionStreaming] =
    useState<boolean>(false);

  // Set the text field focus on load
  useEffect(() => {
    // Focus the text area
    messageFormRef.current?.text.focus();
  }, []);

  // Resize the textarea according to its contents
  useEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.style.height = "auto";
      textArea.style.height = `${textArea.scrollHeight}px`;
    }
  }, [text]);

  // Change handler for text area
  const handleTextChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setText(event.target.value);
  };

  useEffect(() => {
    // fetcher.type === "done" (v2)
    let isDone = messageFetcher.state === "idle" && messageFetcher.data != null;
    // Don't do anything if the fecher is idle and hasn't done anything
    if (isDone) {
      // Set the completion streaming to true
      setIsCompletionStreaming(true);

      // Create a new event source for the completion stream
      const sse = new EventSource(
        `/completion?conversationId=${conversationId}`
      );

      sse.addEventListener("open", (event) => {
        console.log("EventSource connection opened:", event);
      });

      sse.addEventListener("message", (event) => {
        console.log("EventSource message:", event);
        // If the stream is done, save the complete message to the db
        if (event.data === "[DONE]") {
          sse.close();
          revalidator.revalidate();
          // Reset the state variable for the new message
          props.setNewMessage("");
          // Reset the form
          messageFormRef.current?.reset();
          setText("");
          // Focus the text area
          messageFormRef.current?.text.focus();
          setIsCompletionStreaming(false);
        } else {
          // Otherwise, add the new message to the state variable
          props.setNewMessage(
            (prevResults: string) => prevResults + event.data
          );
        }
      });

      sse.addEventListener("error", (event) => {
        console.log("EvenSource error: ", event);
        // Reset the state variable for the new message
        props.setNewMessage("");
        setIsCompletionStreaming(false);
        sse.close();
      });
    }
  }, [messageFetcher]);

  return (
    <messageFetcher.Form
      ref={messageFormRef}
      method="post"
      className="flex flex-col items-start gap-2 p-2"
    >
      <div className="flex w-full flex-row items-center">
        <input type="hidden" name="_action" value="createMessage" />
        <textarea
          ref={textAreaRef}
          name="text"
          className="text-md max-h-52 flex-grow rounded-md border-2 px-3 py-2"
          placeholder="Text"
          value={text}
          rows={1}
          disabled={isSubmitting}
          onChange={handleTextChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              messageFetcher.submit(messageFormRef.current, { replace: true });
            }
          }}
        />
        <button
          type="submit"
          name="_action"
          value="createMessage"
          disabled={isCompletionStreaming}
          className="ml-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
        >
          {isCompletionStreaming ? "Processing..." : "Send"}
        </button>
      </div>
    </messageFetcher.Form>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>An unexpected error occurred: {error.message}</div>;
}
