"use client";

import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type BottomSheetMode = "feed" | "venue-detail";

type BottomSheetProps = {
  header?: ReactNode;
  children: ReactNode;
  mode?: BottomSheetMode;
  overlayContent?: ReactNode;
  onBack?: () => void;
};

// Snap points as percentage of the container height
const SNAP_BOTTOM = 0.2;
const SNAP_PEEK = 0.5; // 45% — hero card + handle + top of feed
const SNAP_FULL = 0.8; // 65% — comfortable browsing
const SNAP_DETAIL = 0.95; // 95% — venue detail view

const SNAPS = [SNAP_BOTTOM, SNAP_PEEK, SNAP_FULL];
const SNAPS_WITH_DETAIL = [SNAP_BOTTOM, SNAP_PEEK, SNAP_FULL, SNAP_DETAIL];

function closestSnap(fraction: number, snaps: number[]): number {
  let best = snaps[0];
  let bestDist = Math.abs(fraction - best);
  for (const s of snaps) {
    const d = Math.abs(fraction - s);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export function BottomSheet({
  header,
  children,
  mode = "feed",
  overlayContent,
  onBack,
}: BottomSheetProps) {
  const [snap, setSnap] = useState(SNAP_PEEK);
  const isDetail = mode === "venue-detail";
  const [dragging, setDragging] = useState(false);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Snap to detail height when mode switches
  useEffect(() => {
    if (isDetail) {
      setSnap(SNAP_DETAIL);
    }
  }, [isDetail]);

  const activeSnaps = isDetail ? SNAPS_WITH_DETAIL : SNAPS;
  const heightPercent = currentHeight !== null ? currentHeight : snap * 100;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      setDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = snap * window.innerHeight;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [snap],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = dragStartHeight.current + deltaY;
      const fraction = Math.max(
        0.2,
        Math.min(0.95, newHeight / window.innerHeight),
      );
      setCurrentHeight(fraction * 100);
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (currentHeight !== null) {
      const fraction = currentHeight / 100;
      const snapped = closestSnap(fraction, activeSnaps);
      setSnap(snapped);
      setCurrentHeight(null);
      // If in detail mode and user drags below detail threshold, go back
      if (isDetail && snapped < SNAP_DETAIL && onBack) {
        onBack();
      }
      // Collapse the hero card on any snap change
      window.dispatchEvent(new CustomEvent("herocard:collapse"));
    }
  }, [dragging, currentHeight, activeSnaps, isDetail, onBack]);

  // When the hero card wants to expand: snap down first if at FULL, then signal ready
  useEffect(() => {
    const handleExpand = () => {
      if (snap === SNAP_FULL) {
        setSnap(SNAP_PEEK);
        // Wait for the snap transition (300ms) before telling hero card to expand
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("herocard:do-expand"));
        }, 300);
      } else {
        // Already has room — expand immediately
        window.dispatchEvent(new CustomEvent("herocard:do-expand"));
      }
    };
    window.addEventListener("herocard:expand", handleExpand);
    return () => window.removeEventListener("herocard:expand", handleExpand);
  }, [snap]);

  useEffect(() => {
    const handleResize = () => setCurrentHeight(null);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20"
      style={{
        height: `${heightPercent}%`,
        transition: dragging
          ? "none"
          : "height 300ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Hero card — absolutely positioned above the sheet, expands upward */}
      {header && (
        <div className="absolute inset-x-0 top-0 z-10 px-4 pb-3 -translate-y-full">
          {header}
        </div>
      )}

      {/* Sheet body with rounded top — takes full container height */}
      <div className="flex h-full flex-col overflow-hidden rounded-t-xl bg-surface-1 shadow-lg">
        {/* Drag handle */}
        <div
          className="flex shrink-0 cursor-grab items-center justify-center py-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="slider"
          aria-label="Resize bottom sheet"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(heightPercent)}
          tabIndex={0}
        >
          <div className="h-1 w-8 rounded-full bg-border" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain hide-scrollbar pb-16">
          {isDetail && overlayContent ? (
            <div className="flex flex-col">
              {/* Back button */}
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </button>
              )}
              {overlayContent}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
