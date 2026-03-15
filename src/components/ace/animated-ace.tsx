"use client";

import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useId, useRef } from "react";
import { Ace } from "@/components/ace/ace";
import {
  AceArmLeft,
  AceArmRight,
  AceBody,
  AceEarLeft,
  AceEarRight,
  AceEyeLeft,
  AceEyeRight,
  AceHeadband,
} from "@/components/ace/ace-parts";
import { useMouseIdle } from "@/components/ace/use-mouse-idle";

type AnimatedAceProps = {
  size?: number;
  className?: string;
  trackingArea?: "window" | "parent";
  idleDelay?: number;
  enableTracking?: boolean;
};

const EYE_SPRING = { stiffness: 300, damping: 25 };
const MAX_EYE_X = 5;
const MAX_EYE_Y = 3;

export function AnimatedAce({
  size = 160,
  className,
  trackingArea = "window",
  idleDelay = 2000,
  enableTracking = true,
}: AnimatedAceProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <Ace size={size} className={className} />;
  }

  return (
    <AnimatedAceInner
      size={size}
      className={className}
      trackingArea={trackingArea}
      idleDelay={idleDelay}
      enableTracking={enableTracking}
    />
  );
}

function AnimatedAceInner({
  size = 160,
  className,
  trackingArea = "window",
  idleDelay = 2000,
  enableTracking = true,
}: AnimatedAceProps) {
  const uid = useId();
  const filterId = `ace-anim-shadow-${uid}`;
  const clipId = `ace-anim-body-${uid}`;
  const height = size * 1.25;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Refs for idle animation targets
  const earLeftRef = useRef<SVGGElement>(null);
  const earRightRef = useRef<SVGGElement>(null);
  const armLeftRef = useRef<SVGGElement>(null);
  const armRightRef = useRef<SVGGElement>(null);
  const eyeLeftRef = useRef<SVGGElement>(null);
  const eyeRightRef = useRef<SVGGElement>(null);
  const bodyGroupRef = useRef<SVGGElement>(null);

  const { mouseX, mouseY, isIdle } = useMouseIdle({
    trackingArea,
    parentRef: containerRef,
    aceRef: svgRef,
    idleDelay,
    enabled: enableTracking,
  });

  // Smooth spring-driven eye offsets
  const springX = useSpring(mouseX, EYE_SPRING);
  const springY = useSpring(mouseY, EYE_SPRING);

  // Iris offset (larger movement)
  const irisX = useTransform(springX, [-1, 1], [-MAX_EYE_X, MAX_EYE_X]);
  const irisY = useTransform(springY, [-1, 1], [-MAX_EYE_Y, MAX_EYE_Y]);

  // --- Idle animations ---
  const idleControlsRef = useRef<AnimationPlaybackControls[]>([]);
  const idleRunningRef = useRef(false);
  const idleAbortRef = useRef<AbortController | null>(null);

  const cancelIdle = useCallback(() => {
    idleRunningRef.current = false;
    if (idleAbortRef.current) {
      idleAbortRef.current.abort();
      idleAbortRef.current = null;
    }
    for (const ctrl of idleControlsRef.current) {
      ctrl.stop();
    }
    idleControlsRef.current = [];
  }, []);

  const runIdle = useCallback(async () => {
    if (idleRunningRef.current) return;
    idleRunningRef.current = true;
    const abort = new AbortController();
    idleAbortRef.current = abort;

    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        abort.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });

    const tracked = (ctrl: AnimationPlaybackControls) => {
      idleControlsRef.current.push(ctrl);
      return ctrl.finished;
    };

    // Idle action definitions
    const blink = async () => {
      if (!eyeLeftRef.current || !eyeRightRef.current) return;
      const opts = { duration: 0.08 } as const;
      // close
      await tracked(animate(eyeLeftRef.current, { scaleY: 0.1 }, opts));
      await tracked(
        animate(eyeRightRef.current, { scaleY: 0.1 }, { duration: 0.01 }),
      );
      // open
      await tracked(animate(eyeLeftRef.current, { scaleY: 1 }, opts));
      await tracked(
        animate(eyeRightRef.current, { scaleY: 1 }, { duration: 0.01 }),
      );
    };

    const doubleBlink = async () => {
      await blink();
      await wait(120);
      await blink();
    };

    const earTwitch = async () => {
      const ear =
        Math.random() > 0.5 ? earLeftRef.current : earRightRef.current;
      if (!ear) return;
      const dir = Math.random() > 0.5 ? 1 : -1;
      await tracked(
        animate(
          ear,
          { rotate: 18 * dir },
          { type: "spring", stiffness: 500, damping: 8 },
        ),
      );
      await tracked(
        animate(
          ear,
          { rotate: -6 * dir },
          { type: "spring", stiffness: 400, damping: 10 },
        ),
      );
      await tracked(
        animate(
          ear,
          { rotate: 0 },
          { type: "spring", stiffness: 300, damping: 15 },
        ),
      );
    };

    const wave = async () => {
      const arm =
        Math.random() > 0.5 ? armRightRef.current : armLeftRef.current;
      if (!arm) return;
      const dir = arm === armRightRef.current ? -1 : 1;
      // Lift arm up first
      await tracked(
        animate(
          arm,
          { rotate: 35 * dir },
          { type: "spring", stiffness: 180, damping: 14 },
        ),
      );
      // Wave back and forth
      for (let i = 0; i < 2; i++) {
        await tracked(
          animate(
            arm,
            { rotate: 15 * dir },
            { duration: 0.25, ease: "easeInOut" },
          ),
        );
        await tracked(
          animate(
            arm,
            { rotate: 35 * dir },
            { duration: 0.25, ease: "easeInOut" },
          ),
        );
      }
      // Return to rest
      await tracked(
        animate(
          arm,
          { rotate: 0 },
          { type: "spring", stiffness: 120, damping: 14 },
        ),
      );
    };

    const lookAround = async () => {
      if (!eyeLeftRef.current || !eyeRightRef.current) return;
      const shift = { translateX: -4 };
      const opts = { type: "spring" as const, stiffness: 120, damping: 14 };
      await Promise.all([
        tracked(animate(eyeLeftRef.current, shift, opts)),
        tracked(animate(eyeRightRef.current, shift, opts)),
      ]);
      await wait(400);
      const shiftR = { translateX: 4 };
      await Promise.all([
        tracked(animate(eyeLeftRef.current, shiftR, opts)),
        tracked(animate(eyeRightRef.current, shiftR, opts)),
      ]);
      await wait(400);
      const center = { translateX: 0 };
      await Promise.all([
        tracked(animate(eyeLeftRef.current, center, opts)),
        tracked(animate(eyeRightRef.current, center, opts)),
      ]);
    };

    const subtleBounce = async () => {
      if (!bodyGroupRef.current) return;
      // Two bounces — first bigger, second smaller
      await tracked(
        animate(
          bodyGroupRef.current,
          { translateY: -8 },
          { type: "spring", stiffness: 300, damping: 10 },
        ),
      );
      await tracked(
        animate(
          bodyGroupRef.current,
          { translateY: 0 },
          { type: "spring", stiffness: 200, damping: 12 },
        ),
      );
      await tracked(
        animate(
          bodyGroupRef.current,
          { translateY: -4 },
          { type: "spring", stiffness: 300, damping: 12 },
        ),
      );
      await tracked(
        animate(
          bodyGroupRef.current,
          { translateY: 0 },
          { type: "spring", stiffness: 150, damping: 15 },
        ),
      );
    };

    const actions = [
      blink,
      doubleBlink,
      earTwitch,
      wave,
      lookAround,
      subtleBounce,
    ];

    try {
      // Always start with a blink
      await blink();
      await wait(1500);

      while (idleRunningRef.current) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        await action();
        await wait(2000 + Math.random() * 2000);
      }
    } catch {
      // AbortError — idle was cancelled, that's fine
    }
  }, []);

  // Start/stop idle loop based on isIdle state
  useEffect(() => {
    if (isIdle) {
      runIdle();
    } else {
      cancelIdle();
    }

    return cancelIdle;
  }, [isIdle, runIdle, cancelIdle]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: size, height }}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 250"
        width={size}
        height={height}
        role="img"
        aria-label="Ace — the Match mascot"
      >
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="6"
              floodColor="#000"
              floodOpacity="0.2"
            />
          </filter>
          <clipPath id={clipId}>
            <path d="M 45 100 C 45 30, 155 30, 155 100 C 160 180, 145 215, 100 215 C 55 215, 40 180, 45 100 Z" />
          </clipPath>
        </defs>

        {/* Floor shadow */}
        <ellipse cx="100" cy="225" rx="55" ry="8" fill="rgba(0,0,0,0.15)" />

        {/* Character group — bounces during idle */}
        <motion.g ref={bodyGroupRef} filter={`url(#${filterId})`}>
          {/* Ears */}
          <AceEarLeft ref={earLeftRef} />
          <AceEarRight ref={earRightRef} />

          {/* Static body parts */}
          <AceBody clipId={clipId} />

          {/* Eyes — iris and highlight driven by mouse tracking */}
          <AceEyeLeft ref={eyeLeftRef} trackingStyle={{ x: irisX, y: irisY }} />
          <AceEyeRight
            ref={eyeRightRef}
            trackingStyle={{ x: irisX, y: irisY }}
          />

          {/* Headband */}
          <AceHeadband clipId={clipId} />

          {/* Arms */}
          <AceArmLeft ref={armLeftRef} />
          <AceArmRight ref={armRightRef} />
        </motion.g>
      </svg>
    </div>
  );
}
