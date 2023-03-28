import { Link } from "@remix-run/react";

export default function ConversationIndexPage() {
  return (
    <p className="p-4">
      No conversation selected. Select a conversation on the left, or{" "}
      <Link to="new" className="text-blue-500 underline">
        create a new conversation.
      </Link>
    </p>
  );
}
