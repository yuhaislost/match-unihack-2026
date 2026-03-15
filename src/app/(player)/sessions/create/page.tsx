import Link from "next/link";
import { CreateSessionForm } from "@/components/schedule/create-session-form";

export default function CreateSessionPage() {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <Link
          href="/sessions"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-secondary transition-colors hover:bg-surface-3"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-text-primary">Create Session</h1>
      </div>
      <CreateSessionForm />
    </div>
  );
}
