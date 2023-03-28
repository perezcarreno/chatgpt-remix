import type { V2_MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { useOptionalUser } from "~/utils";

export const meta: V2_MetaFunction = () => [{ title: "ChatGPT Remix" }];

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-100">
      <div className="flex min-h-full w-96 flex-col justify-center rounded-lg bg-white p-12 shadow-lg">
        <h1 className="mb-8 text-center text-4xl font-extrabold tracking-tight text-slate-800">
          ChatGPT
          <span className="block text-yellow-500 drop-shadow-md">Remix</span>
        </h1>
        <div className="mx-auto mt-10 max-w-sm sm:flex sm:max-w-none sm:justify-center">
          {user ? (
            <Link
              to="/conversations"
              className="flex items-center justify-center rounded-md border border-transparent bg-blue-500 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-600 focus:bg-blue-400 sm:px-8"
            >
              View Conversations
            </Link>
          ) : (
            <div className="space-y-4 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5 sm:space-y-0">
              <Link
                to="/join"
                className="flex items-center justify-center rounded-md border border-transparent bg-slate-200 px-4 py-3 text-base font-medium text-slate-600 shadow-sm hover:bg-slate-300 sm:px-8"
              >
                Sign up
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center rounded-md  bg-blue-500 px-4 py-3 font-medium text-white  hover:bg-blue-600 focus:bg-blue-400"
              >
                Log In
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
