"use client";

import { useId } from "react";

type AceProps = {
  size?: number;
  className?: string;
};

export function Ace({ size = 160, className }: AceProps) {
  const uid = useId();
  const filterId = `ace-shadow-${uid}`;
  const clipId = `ace-body-${uid}`;

  // The SVG viewBox is 200x250, so height = size * (250/200)
  const height = size * 1.25;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 250"
      width={size}
      height={height}
      className={className}
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

      {/* Character */}
      <g filter={`url(#${filterId})`}>
        {/* Ears */}
        <g>
          <circle cx="55" cy="55" r="14" fill="#E6B98A" />
          <circle cx="55" cy="57" r="6" fill="#F9E4C8" />
          <circle cx="145" cy="55" r="14" fill="#E6B98A" />
          <circle cx="145" cy="57" r="6" fill="#F9E4C8" />
        </g>

        {/* Feet */}
        <rect x="65" y="208" width="22" height="14" rx="7" fill="#D4A373" />
        <rect x="113" y="208" width="22" height="14" rx="7" fill="#D4A373" />

        {/* Main body */}
        <path
          d="M 45 100 C 45 30, 155 30, 155 100 C 160 180, 145 215, 100 215 C 55 215, 40 180, 45 100 Z"
          fill="#E6B98A"
        />

        {/* Belly */}
        <g clipPath={`url(#${clipId})`}>
          <ellipse cx="100" cy="165" rx="42" ry="45" fill="#F9E4C8" />
        </g>

        {/* Medal */}
        <g>
          <path
            d="M 65 125 L 100 155 L 135 125"
            fill="none"
            stroke="#E53E3E"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 65 125 L 100 155 L 135 125"
            fill="none"
            stroke="#9B2C2C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
          />
          <g transform="translate(100, 165)">
            <circle cx="0" cy="0" r="16" fill="#F6E05E" />
            <circle cx="0" cy="0" r="12" fill="#D69E2E" />
            <path
              d="M -6 4 L -6 -4 L 0 2 L 6 -4 L 6 4"
              fill="none"
              stroke="#FFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* Muzzle / Cheeks */}
        <ellipse cx="100" cy="115" rx="36" ry="22" fill="#F9E4C8" />
        <ellipse cx="100" cy="106" rx="10" ry="6.5" fill="#2D3748" />
        <path
          d="M 86 118 Q 100 130 114 118"
          fill="none"
          stroke="#2D3748"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="68" cy="115" r="7" fill="#FFB6C1" opacity="0.8" />
        <circle cx="132" cy="115" r="7" fill="#FFB6C1" opacity="0.8" />

        {/* Eyes */}
        <g transform="translate(72, 88)">
          <circle cx="0" cy="0" r="11" fill="#2D3748" />
          <circle cx="3.5" cy="-3.5" r="3.5" fill="#FFF" />
        </g>
        <g transform="translate(128, 88)">
          <circle cx="0" cy="0" r="11" fill="#2D3748" />
          <circle cx="3.5" cy="-3.5" r="3.5" fill="#FFF" />
        </g>

        {/* Headband */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d="M 30 68 Q 100 80 170 68 L 170 54 Q 100 66 30 54 Z"
            fill="#00D2FF"
          />
          <path
            d="M 85 67 L 115 67"
            fill="none"
            stroke="#FFF"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>

        {/* Arms */}
        <line
          x1="45"
          y1="135"
          x2="38"
          y2="160"
          stroke="#E6B98A"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <line
          x1="155"
          y1="135"
          x2="162"
          y2="160"
          stroke="#E6B98A"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
