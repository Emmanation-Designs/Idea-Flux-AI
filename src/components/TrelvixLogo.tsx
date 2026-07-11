import React from 'react';

interface TrelvixLogoProps {
  className?: string; // Tailwind class like "w-12 h-12"
  glow?: boolean;
}

export const TrelvixLogo = ({ className = "w-12 h-12", glow = true }: TrelvixLogoProps) => {
  return (
    <div className={`relative ${className} shrink-0 select-none flex items-center justify-center overflow-visible`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main Emerald Gradient */}
          <linearGradient id="trelvixEmerald" x1="20%" y1="20%" x2="80%" y2="80%">
            <stop offset="0%" stopColor="#00B26F" />
            <stop offset="100%" stopColor="#05E593" />
          </linearGradient>

          {/* Core Interlocking Teal-to-Emerald Gradient */}
          <linearGradient id="trelvixTeal" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#007d4e" />
            <stop offset="50%" stopColor="#00B26F" />
            <stop offset="100%" stopColor="#00E58F" />
          </linearGradient>

          {/* Premium Metallic Bevel Highlight */}
          <linearGradient id="bevelHighlight" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Hexagon Outline Gradient */}
          <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00B26F" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#05E593" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00B26F" stopOpacity="0.6" />
          </linearGradient>

          {/* Glow filter for maximum futuristic atmosphere */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle drop shadow for depth */}
          <filter id="svgShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* BACKGROUND GLOW (only rendered if glow is true) */}
        {glow && (
          <g filter="url(#neonGlow)" className="opacity-40 dark:opacity-60">
            {/* Mirroring glows behind the main shapes */}
            <path
              d="M 58,22 L 28,52 L 38,52 L 58,32 L 72,32 L 62,22 Z"
              fill="url(#trelvixEmerald)"
            />
            <path
              d="M 42,78 L 72,48 L 62,48 L 42,68 L 28,68 L 38,78 Z"
              fill="url(#trelvixTeal)"
            />
          </g>
        )}

        {/* 1. FUTURISTIC SEGMENTED HEXAGON FRAME */}
        <g filter="url(#svgShadow)">
          {/* Top-Right edge */}
          <path
            d="M 50,8 L 86.4,29"
            stroke="url(#hexGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="dark:stroke-emerald-500/40 stroke-emerald-600/30"
          />
          {/* Right edge */}
          <path
            d="M 86.4,37 L 86.4,63"
            stroke="url(#hexGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="dark:stroke-emerald-500/40 stroke-emerald-600/30"
          />
          {/* Bottom-Right edge */}
          <path
            d="M 86.4,71 L 50,92"
            stroke="url(#hexGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="dark:stroke-emerald-500/40 stroke-emerald-600/30"
          />
          {/* Bottom-Left edge */}
          <path
            d="M 50,92 L 13.6,71"
            stroke="url(#hexGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="dark:stroke-emerald-500/40 stroke-emerald-600/30"
          />
          {/* Left edge */}
          <path
            d="M 13.6,63 L 13.6,37"
            stroke="url(#hexGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="dark:stroke-emerald-500/40 stroke-emerald-600/30"
          />
          {/* Top-Left edge */}
          <path
            d="M 13.6,29 L 50,8"
            stroke="url(#hexGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="dark:stroke-emerald-500/40 stroke-emerald-600/30"
          />
        </g>

        {/* 2. SUBTLE CIRCUIT INTEGRATION */}
        <g className="opacity-80">
          {/* Top circuit connection */}
          <path
            d="M 45,41 L 52,34 L 66,34"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            strokeOpacity="0.4"
            className="dark:stroke-emerald-300 stroke-emerald-600"
          />
          <circle
            cx="45"
            cy="41"
            r="1.8"
            fill="#05E593"
            stroke="#ffffff"
            strokeWidth="1"
            className="dark:stroke-zinc-950 stroke-white"
          />

          {/* Bottom circuit connection */}
          <path
            d="M 55,59 L 48,66 L 34,66"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            strokeOpacity="0.4"
            className="dark:stroke-emerald-300 stroke-emerald-600"
          />
          <circle
            cx="55"
            cy="59"
            r="1.8"
            fill="#05E593"
            stroke="#ffffff"
            strokeWidth="1"
            className="dark:stroke-zinc-950 stroke-white"
          />
        </g>

        {/* 3. CORE INTERLOCKING LIGHTNING BOLT SECTIONS (T & V) */}
        <g filter="url(#svgShadow)">
          {/* Top Half - stylized "T" */}
          <path
            d="M 58,22 L 28,52 L 38,52 L 58,32 L 72,32 L 62,22 Z"
            fill="url(#trelvixEmerald)"
            className="dark:drop-shadow-[0_0_8px_rgba(0,178,111,0.5)]"
          />
          {/* Top Half Bevel Highlight to create 3D aesthetic */}
          <path
            d="M 58,22 L 28,52 L 31,52 L 59,24 Z"
            fill="url(#bevelHighlight)"
          />

          {/* Bottom Half - stylized "V" */}
          <path
            d="M 42,78 L 72,48 L 62,48 L 42,68 L 28,68 L 38,78 Z"
            fill="url(#trelvixTeal)"
            className="dark:drop-shadow-[0_0_8px_rgba(0,125,78,0.5)]"
          />
          {/* Bottom Half Bevel Highlight to create 3D aesthetic */}
          <path
            d="M 42,78 L 72,48 L 69,48 L 41,76 Z"
            fill="url(#bevelHighlight)"
          />
        </g>

        {/* 4. OVERLAPPING FOREGROUND ACCENT SHARDS FOR ADDED DEPTH */}
        <g filter="url(#svgShadow)">
          {/* Small sharp accent shard inside top half */}
          <path
            d="M 55,27 L 45,37 L 50,37 L 58,29 Z"
            fill="#ffffff"
            fillOpacity="0.25"
          />
          {/* Small sharp accent shard inside bottom half */}
          <path
            d="M 45,73 L 55,63 L 50,63 L 42,71 Z"
            fill="#ffffff"
            fillOpacity="0.25"
          />
        </g>
      </svg>
    </div>
  );
};

