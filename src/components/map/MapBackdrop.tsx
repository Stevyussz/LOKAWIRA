"use client";

import React from "react";

const ROAD_D = "M 400 700 L 2000 700 M 1120 200 L 1120 1400 M 780 420 L 1640 1160 M 760 1120 L 1660 460";
const RIVER_D = "M 160 180 C 520 480, 680 940, 1140 1060 C 1560 1160, 1840 960, 2280 1280";

// latar peta bergaaya lontar (tanah, blok, taman, sungai, jalan) di kanvas 2400x1600
export default function MapBackdrop() {
  return (
    <>
          <defs>
            <radialGradient id="landGlow" cx="50%" cy="46%" r="65%">
              <stop offset="0%" stopColor="var(--map-road)" stopOpacity="0.55" />
              <stop offset="60%" stopColor="var(--map-land)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--map-tint)" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--map-water)" />
              <stop offset="100%" stopColor="var(--map-water-deep)" />
            </linearGradient>
            <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--map-block)" />
              <stop offset="100%" stopColor="var(--map-block)" stopOpacity="0.82" />
            </linearGradient>
            <pattern id="motif" width="96" height="96" patternUnits="userSpaceOnUse">
              <path
                d="M48 8 L88 48 L48 88 L8 48 Z M48 28 L68 48 L48 68 L28 48 Z"
                fill="none"
                stroke="var(--map-pattern)"
                strokeWidth="2"
              />
              <circle cx="48" cy="48" r="4" fill="var(--map-pattern)" />
            </pattern>
          </defs>

          <rect width="2400" height="1600" fill="var(--map-land)" />
          <rect width="2400" height="1600" fill="url(#motif)" />
          <rect width="2400" height="1600" fill="url(#landGlow)" />

          {/* Blok kawasan */}
          <g>
            {[
              [640, 380, 440, 280],
              [1140, 360, 520, 310],
              [620, 720, 460, 380],
              [1320, 740, 480, 360],
              [920, 1120, 560, 280],
            ].map(([x, y, w, h]) => (
              <g key={`${x}-${y}`}>
                {/* bayangan murah: kotak geser, tanpa filter blur (berat di HP) */}
                <rect x={x} y={y + 12} width={w} height={h} rx="48" fill="#4A341C" fillOpacity="0.12" />
                <rect x={x} y={y} width={w} height={h} rx="48" fill="url(#blockGrad)" />
              </g>
            ))}
          </g>

          {/* atap banugnan kecil di dlm blok */}
          {[
            [690, 430, 120, 90], [840, 430, 90, 120], [700, 560, 150, 70],
            [1190, 410, 140, 100], [1360, 410, 110, 140], [1200, 540, 200, 70],
            [680, 780, 130, 110], [840, 790, 150, 80], [680, 930, 190, 90],
            [1370, 800, 150, 100], [1550, 800, 120, 140], [1380, 930, 160, 90],
            [980, 1170, 140, 90], [1140, 1170, 190, 90], [1000, 1290, 220, 60],
          ].map(([x, y, w, h]) => (
            <rect
              key={`b-${x}-${y}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="14"
              fill="var(--map-road)"
              fillOpacity="0.55"
              stroke="var(--map-road-edge)"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
          ))}

          {/* taman dgn pepohonan */}
          {[
            [1720, 300, 380, 250], [360, 1160, 420, 240],
            [1600, 1180, 300, 200], [300, 420, 260, 190],
          ].map(([x, y, w, h]) => (
            <g key={`p-${x}-${y}`}>
              <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="var(--map-park)" />
              {[0.22, 0.42, 0.62, 0.8].map((fx, k) => (
                <circle
                  key={`t${k}`}
                  cx={x + w * fx}
                  cy={y + h * (k % 2 ? 0.62 : 0.38)}
                  r="20"
                  fill="#7FA866"
                  fillOpacity="0.55"
                />
              ))}
            </g>
          ))}

          {/* Sungai */}
          <path d={RIVER_D} fill="none" stroke="var(--map-water-deep)" strokeWidth="96" strokeLinecap="round" />
          <path d={RIVER_D} fill="none" stroke="url(#waterGrad)" strokeWidth="74" strokeLinecap="round" />

          {/* Jalan */}
          <path d={ROAD_D} fill="none" stroke="var(--map-road-edge)" strokeWidth="36" strokeLinecap="round" />
          <path d={ROAD_D} fill="none" stroke="var(--map-road)" strokeWidth="26" strokeLinecap="round" />

    </>
  );
}
