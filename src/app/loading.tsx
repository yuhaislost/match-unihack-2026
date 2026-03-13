import Image from "next/image";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Ace mascot — bounces in */}
      <div className="animate-splash-bounce" style={{ opacity: 0 }}>
        <Image
          src="/ace.svg"
          alt="Ace — the Match mascot"
          width={160}
          height={200}
          priority
        />
      </div>

      {/* Wordmark + tagline — fades in with delay */}
      <div
        className="mt-6 flex flex-col items-center gap-1"
        style={{
          opacity: 0,
          animation: "feed-card-enter 0.5s ease-out 0.7s forwards",
        }}
      >
        <h1 className="text-display text-text-primary">match</h1>
        <p className="text-small text-text-secondary">find your game</p>
      </div>
    </div>
  );
}
