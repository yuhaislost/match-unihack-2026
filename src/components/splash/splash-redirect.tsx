"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SplashScreen } from "@/components/splash/splash-screen";

type SplashRedirectProps = {
  redirectTo: string;
};

export function SplashRedirect({ redirectTo }: SplashRedirectProps) {
  const router = useRouter();

  const handleComplete = useCallback(() => {
    router.replace(redirectTo);
  }, [router, redirectTo]);

  return <SplashScreen onComplete={handleComplete} />;
}
