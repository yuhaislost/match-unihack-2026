"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type SplashPhase = "idle" | "ace-in" | "text-in" | "fading-out" | "done";

type SplashScreenProps = {
  onComplete: () => void;
};

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<SplashPhase>("idle");

  const startFadeOut = useCallback(() => {
    setPhase("fading-out");
    const timer = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 300);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    // Immediately show Ace bouncing in
    const t1 = setTimeout(() => setPhase("ace-in"), 50);
    // After Ace lands, fade in the text
    const t2 = setTimeout(() => setPhase("text-in"), 700);
    // After a moment to read, fade out the whole splash
    const t3 = setTimeout(() => startFadeOut(), 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [startFadeOut]);

  if (phase === "done") return null;

  const showText = phase === "text-in" || phase === "fading-out";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background ${
        phase === "fading-out" ? "animate-splash-fade-out" : ""
      }`}
    >
      {/* Ace mascot */}
      <div
        className={phase !== "idle" ? "animate-splash-bounce" : "opacity-0"}
        style={{ opacity: phase === "idle" ? 0 : undefined }}
      >
        <Image
          src="/ace.svg"
          alt="Ace — the Match mascot"
          width={160}
          height={200}
          priority
        />
      </div>

      {/* Wordmark + tagline */}
      <div
        className="mt-6 flex flex-col items-center gap-1 transition-all duration-500"
        style={{
          opacity: showText ? 1 : 0,
          transform: showText ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <h1 className="text-display text-text-primary">match</h1>
        <p className="text-small text-text-secondary">find your game</p>
      </div>
    </div>
  );
}
