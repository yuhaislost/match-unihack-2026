import { Ace } from "@/components/ace/ace";
import { AnimatedAce } from "@/components/ace/animated-ace";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-between py-10">
      {/* Top — Ace hero + branding */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="animate-feed-enter">
          <AnimatedAce size={180} trackingArea="window" idleDelay={1000} />
        </div>
        <div className="mt-2 flex flex-col items-center gap-1">
          <h1 className="text-display text-text-primary">Match</h1>
          <p className="text-body text-text-secondary">
            Find your game. Play badminton.
          </p>
        </div>
      </div>

      {/* Bottom — auth actions */}
      <div className="w-full px-6">
        <LoginForm />
      </div>
    </div>
  );
}
