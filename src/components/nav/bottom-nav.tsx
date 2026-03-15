"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Compass,
  LayoutDashboard,
  MapPin,
  ShoppingBag,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const ICON_MAP: Record<string, LucideIcon> = {
  compass: Compass,
  "calendar-days": CalendarDays,
  user: User,
  "layout-dashboard": LayoutDashboard,
  "map-pin": MapPin,
  "shopping-bag": ShoppingBag,
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type BottomNavProps = {
  items: NavItem[];
};

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const activeIndex = items.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  const updatePill = useCallback(() => {
    const nav = navRef.current;
    const activeEl = itemRefs.current[activeIndex];
    if (!nav || !activeEl || activeIndex === -1) {
      setPillStyle(null);
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    setPillStyle({
      left: itemRect.left - navRect.left,
      width: itemRect.width,
    });
  }, [activeIndex]);

  useEffect(() => {
    updatePill();
  }, [updatePill]);

  // Recalculate on resize
  useEffect(() => {
    window.addEventListener("resize", updatePill);
    return () => window.removeEventListener("resize", updatePill);
  }, [updatePill]);

  return (
    <div className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-[var(--viewport-max)] -translate-x-1/2 bg-gradient-to-t from-[var(--background)] to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
      <nav
        ref={navRef}
        className="pointer-events-auto relative flex h-[3.75rem] items-center justify-around rounded-[var(--radius-full)] border border-white/[0.06] bg-[var(--surface-1)] shadow-lg"
      >
        {/* Sliding pill indicator */}
        {pillStyle && (
          <span
            className="absolute top-1 bottom-1 rounded-[var(--radius-full)] bg-[var(--primary)]/10 transition-all duration-300 ease-[var(--ease-out)]"
            style={{
              left: pillStyle.left + 8,
              width: pillStyle.width - 16,
            }}
          />
        )}

        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = ICON_MAP[item.icon];

          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className="group relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
            >
              {/* Icon */}
              <span
                className={`transition-all duration-[var(--duration-fast)] ease-[var(--ease-spring)] ${
                  isActive
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-tertiary)] group-hover:scale-110 group-hover:text-[var(--text-secondary)]"
                } ${!isActive ? "group-active:scale-90" : ""}`}
              >
                {Icon && <Icon size={22} strokeWidth={isActive ? 2 : 1.75} />}
              </span>

              {/* Label */}
              <span
                className={`text-caption transition-colors duration-[var(--duration-fast)] ${
                  isActive
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
