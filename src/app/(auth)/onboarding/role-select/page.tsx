import Image from "next/image";
import { RoleSelectForm } from "@/components/auth/role-select-form";

export default function RoleSelectPage() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      {/* Ace + heading */}
      <div className="flex flex-col items-center gap-3 pt-8 pb-8">
        <div className="animate-feed-enter">
          <Image src="/ace.svg" alt="Ace" width={100} height={125} priority />
        </div>
        <div className="text-center">
          <h1 className="text-title-lg mb-2">How will you use Match?</h1>
          <p className="text-body text-text-secondary">
            Choose your role to get started.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm mx-auto">
        <RoleSelectForm />
      </div>
    </div>
  );
}
