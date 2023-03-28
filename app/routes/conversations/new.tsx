import type { ActionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import * as React from "react";

import { createConversation } from "~/models/conversation.server";
import { requireUserId } from "~/session.server";

export async function action({ request }: ActionArgs) {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");

  if (typeof title !== "string" || title.length === 0) {
    return json(
      { errors: { title: "Title is required", body: null } },
      { status: 400 }
    );
  }

  const conversation = await createConversation({ title, userId });

  return redirect(`/conversations/${conversation.id}`);
}

export default function NewConversationPage() {
  const actionData = useActionData<typeof action>();
  const titleRef = React.useRef<HTMLInputElement | null>(null);

  // Focus on the title input when the page loads
  React.useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="flex h-full flex-col justify-between gap-4 p-4">
      <Form
        method="post"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
        }}
      >
        <div>
          <label className="flex w-full flex-col gap-1">
            <span>Conversation Title: </span>
            <input
              ref={titleRef}
              name="title"
              className="flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose"
              aria-invalid={actionData?.errors?.title ? true : undefined}
              aria-errormessage={
                actionData?.errors?.title ? "title-error" : undefined
              }
            />
          </label>
          {actionData?.errors?.title && (
            <div className="pt-1 text-red-700" id="title-error">
              {actionData.errors.title}
            </div>
          )}
        </div>

        <div className="text-right">
          <button
            type="submit"
            className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
          >
            Create Conversation
          </button>
        </div>
      </Form>
    </div>
  );
}
