import { Ace } from "@/components/ace/ace";
import { PlayerProfileForm } from "@/components/auth/player-profile-form";

export default function PlayerProfilePage() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      {/* Ace + heading */}
      <div className="flex flex-col items-center gap-3 pt-8 pb-8">
        <div className="animate-feed-enter">
          <Ace size={80} />
        </div>
        <div className="text-center">
          <h1 className="text-title-lg mb-2">Set up your profile</h1>
          <p className="text-body text-text-secondary">
            Tell us about your skill level so we can find you the best matches.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm mx-auto">
        <PlayerProfileForm />
      </div>
    </div>
  );
}
