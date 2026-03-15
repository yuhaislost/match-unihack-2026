"use client";

import { useMotionValue } from "motion/react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type UseMouseIdleOptions = {
  trackingArea: "window" | "parent";
  parentRef?: RefObject<HTMLElement | null>;
  aceRef?: RefObject<SVGSVGElement | null>;
  idleDelay?: number;
  enabled?: boolean;
};

export function useMouseIdle({
  trackingArea,
  parentRef,
  aceRef,
  idleDelay = 2000,
  enabled = true,
}: UseMouseIdleOptions) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isIdle, setIsIdle] = useState(true);
  const [isTracking, setIsTracking] = useState(false);

  // Separate timers: stopTimer fires 150ms after last move, idleStartTimer fires idleDelay after that
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Use refs to read current state in the callback without adding them as dependencies
  const isIdleRef = useRef(isIdle);
  const isTrackingRef = useRef(isTracking);
  isIdleRef.current = isIdle;
  isTrackingRef.current = isTracking;

  const computeOffset = useCallback(
    (clientX: number, clientY: number) => {
      if (!aceRef?.current) return;

      const svgRect = aceRef.current.getBoundingClientRect();
      const aceCenterX = svgRect.left + svgRect.width / 2;
      const aceCenterY = svgRect.top + svgRect.height * 0.35; // eyes are in upper third

      let areaWidth: number;
      let areaHeight: number;

      if (trackingArea === "parent" && parentRef?.current) {
        const parentRect = parentRef.current.getBoundingClientRect();
        areaWidth = parentRect.width / 2;
        areaHeight = parentRect.height / 2;
      } else {
        areaWidth = window.innerWidth / 2;
        areaHeight = window.innerHeight / 2;
      }

      // Normalize to -1..1 range
      const nx = Math.max(
        -1,
        Math.min(1, (clientX - aceCenterX) / (areaWidth || 1)),
      );
      const ny = Math.max(
        -1,
        Math.min(1, (clientY - aceCenterY) / (areaHeight || 1)),
      );

      mouseX.set(nx);
      mouseY.set(ny);
    },
    [trackingArea, parentRef, aceRef, mouseX, mouseY],
  );

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      lastMoveRef.current = { clientX, clientY };

      if (!isTrackingRef.current) setIsTracking(true);
      if (isIdleRef.current) setIsIdle(false);

      // Cancel any pending idle-start timer
      if (idleStartTimerRef.current) {
        clearTimeout(idleStartTimerRef.current);
        idleStartTimerRef.current = null;
      }

      // Throttle via rAF
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        if (lastMoveRef.current) {
          computeOffset(
            lastMoveRef.current.clientX,
            lastMoveRef.current.clientY,
          );
        }
        rafRef.current = null;
      });

      // Reset stop timer (150ms after last move = "stopped")
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = setTimeout(() => {
        setIsTracking(false);
        // Animate eyes back to center
        mouseX.set(0);
        mouseY.set(0);

        // Start idle after delay (separate timer so it won't be cleared by effect cleanup)
        idleStartTimerRef.current = setTimeout(() => {
          setIsIdle(true);
        }, idleDelay);
      }, 150);
    },
    [computeOffset, idleDelay, mouseX, mouseY],
  );

  useEffect(() => {
    if (!enabled) return;

    const target =
      trackingArea === "parent" && parentRef?.current
        ? parentRef.current
        : window;

    target.addEventListener("mousemove", handlePointerMove as EventListener);
    target.addEventListener("touchmove", handlePointerMove as EventListener, {
      passive: true,
    });

    return () => {
      target.removeEventListener(
        "mousemove",
        handlePointerMove as EventListener,
      );
      target.removeEventListener(
        "touchmove",
        handlePointerMove as EventListener,
      );
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (idleStartTimerRef.current) clearTimeout(idleStartTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, trackingArea, parentRef, handlePointerMove]);

  return { mouseX, mouseY, isIdle, isTracking };
}
