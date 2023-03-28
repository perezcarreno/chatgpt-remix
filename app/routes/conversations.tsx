import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/session.server";
import { useUser } from "~/utils";
import { getConversationListItems } from "~/models/conversation.server";

export async function loader({ request }: LoaderArgs) {
  const userId = await requireUserId(request);
  const conversationListItems = await getConversationListItems({ userId });
  return json({ conversationListItems });
}

export default function ConversationPage() {
  const data = useLoaderData<typeof loader>();
  const user = useUser();

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex items-center justify-between bg-slate-800 p-4 text-white">
        <h1 className="text-xl font-bold">
          <Link to=".">ChatGPT Remix</Link>
        </h1>

        <Form action="/logout" method="post">
          <button
            type="submit"
            className="rounded bg-slate-600 py-2 px-4 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
          >
            Logout
          </button>
        </Form>
      </header>

      <main className="flex h-full overflow-hidden bg-white">
        <div className="h-full w-80 border-r bg-gray-50">
          <Link to="new" className="text-l block p-4 text-blue-500">
            + New Conversation
          </Link>

          <hr />

          {data.conversationListItems.length === 0 ? (
            <p className="p-4">No conversations yet</p>
          ) : (
            <ol>
              {data.conversationListItems.map((conversation) => (
                <li key={conversation.id}>
                  <NavLink
                    className={({ isActive }) =>
                      `text-l block border-b p-4 ${isActive ? "bg-white" : ""}`
                    }
                    to={conversation.id}
                  >
                    {conversation.title}
                  </NavLink>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
