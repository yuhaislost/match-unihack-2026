import Image from "next/image";
import { MerchantProfileForm } from "@/components/auth/merchant-profile-form";

export default function MerchantProfilePage() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      {/* Ace + heading */}
      <div className="flex flex-col items-center gap-3 pt-8 pb-8">
        <div className="animate-feed-enter">
          <Image
            src="/ace.svg"
            alt="Ace"
            width={80}
            height={100}
            priority
          />
        </div>
        <div className="text-center">
          <h1 className="text-title-lg mb-2">Set up your venue</h1>
          <p className="text-body text-text-secondary">
            Tell us about your business to get started.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm mx-auto">
        <MerchantProfileForm />
      </div>
    </div>
  );
}
