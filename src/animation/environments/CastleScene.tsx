import React from "react";
import { EnvironmentMood } from "../types";

export interface CastleSceneProps {
  mood?: EnvironmentMood;
  frame?: number;
  width?: number;
  height?: number;
  showSun?: boolean;
  showMountains?: boolean;
  showWall?: boolean;
  showGate?: boolean;
  showFlag?: boolean;
  flagColor?: string;
  flagEmblemColor?: string;
  torchFlicker?: boolean;
  children?: React.ReactNode;
}

interface MoodColors {
  skyStops: [string, string, string];
  wallStops: [string, string];
  groundStops: [string, string];
  mountains: [string, string];
  sunColor: string;
  sunOpacity: number;
  sunPos: [number, number];
  tintColor: string;
  tintOpacity: number;
}

const MOOD_THEMES: Record<EnvironmentMood, MoodColors> = {
  day: {
    skyStops: ["#61a8d2", "#b6d6da", "#e7bb84"],
    wallStops: ["#c5a77e", "#7c654f"],
    groundStops: ["#d9b17c", "#866b57"],
    mountains: ["#688b87", "#507770"],
    sunColor: "#fff4b0",
    sunOpacity: 0.85,
    sunPos: [1090, 145],
    tintColor: "#ffce85",
    tintOpacity: 0.05
  },
  golden: {
    skyStops: ["#6b5a8e", "#e89a6a", "#f9d49c"],
    wallStops: ["#a87856", "#614030"],
    groundStops: ["#b88458", "#633e28"],
    mountains: ["#5e5466", "#453842"],
    sunColor: "#ffc27a",
    sunOpacity: 0.9,
    sunPos: [1020, 180],
    tintColor: "#ff8c3b",
    tintOpacity: 0.12
  },
  dusk: {
    skyStops: ["#3d3360", "#8a5a86", "#f7cf98"],
    wallStops: ["#7a5868", "#402e3a"],
    groundStops: ["#734b4c", "#3d262b"],
    mountains: ["#4a3a52", "#35273b"],
    sunColor: "#ffaa7a",
    sunOpacity: 0.8,
    sunPos: [960, 220],
    tintColor: "#9c4873",
    tintOpacity: 0.1
  },
  night: {
    skyStops: ["#0b1028", "#1d2550", "#3a3570"],
    wallStops: ["#303752", "#181d2e"],
    groundStops: ["#252b42", "#141829"],
    mountains: ["#181e33", "#101424"],
    sunColor: "#e6edff", // Moon
    sunOpacity: 0.9,
    sunPos: [1080, 130],
    tintColor: "#1d274d",
    tintOpacity: 0.2
  }
};

export const CastleScene: React.FC<CastleSceneProps> = ({
  mood = "day",
  frame = 0,
  width = 1920,
  height = 1080,
  showSun = true,
  showMountains = true,
  showWall = true,
  showGate = true,
  showFlag = true,
  flagColor = "#c84132",
  flagEmblemColor = "#e7bb5a",
  torchFlicker = true,
  children
}) => {
  const theme = MOOD_THEMES[mood] || MOOD_THEMES.day;

  // Flag waving animation
  const flagWave1 = Math.sin(frame * 0.18) * 8;
  const flagWave2 = Math.cos(frame * 0.15) * 6;

  // Torch flickering
  const torchLight1 = torchFlicker ? 0.75 + Math.sin(frame * 0.4) * 0.15 + Math.cos(frame * 0.7) * 0.1 : 0.8;
  const torchLight2 = torchFlicker ? 0.75 + Math.cos(frame * 0.45) * 0.15 + Math.sin(frame * 0.65) * 0.1 : 0.8;

  // Unique SVG IDs
  const idSuffix = `_${mood}`;

  return (
    <svg
      viewBox="0 0 1280 720"
      width={width}
      height={height}
      style={{
        display: "block",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%"
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Sky Gradient */}
        <linearGradient id={`castle_sky${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.skyStops[0]} />
          <stop offset="65%" stopColor={theme.skyStops[1]} />
          <stop offset="100%" stopColor={theme.skyStops[2]} />
        </linearGradient>

        {/* Wall Gradient */}
        <linearGradient id={`castle_wall${idSuffix}`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={theme.wallStops[0]} />
          <stop offset="100%" stopColor={theme.wallStops[1]} />
        </linearGradient>

        {/* Ground Gradient */}
        <linearGradient id={`castle_ground${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.groundStops[0]} />
          <stop offset="100%" stopColor={theme.groundStops[1]} />
        </linearGradient>

        {/* Sun / Moon Radial Gradient */}
        <radialGradient id={`castle_sun${idSuffix}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={theme.sunColor} stopOpacity={theme.sunOpacity} />
          <stop offset="50%" stopColor={theme.sunColor} stopOpacity={theme.sunOpacity * 0.4} />
          <stop offset="100%" stopColor={theme.sunColor} stopOpacity="0" />
        </radialGradient>

        {/* Torch Radial Glow */}
        <radialGradient id={`torch_glow${idSuffix}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb03a" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#ff7b1a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ff7b1a" stopOpacity="0" />
        </radialGradient>

        {/* Brick Pattern */}
        <pattern id={`castle_brick${idSuffix}`} width="94" height="42" patternUnits="userSpaceOnUse">
          <path
            d="M 0 0 H 94 M 47 0 V 21 M 0 21 H 94 M 0 21 V 42 M 94 21 V 42"
            stroke="#4a3728"
            strokeWidth="3"
            opacity="0.25"
            fill="none"
          />
        </pattern>
      </defs>

      {/* 1. SKY */}
      <rect width="1280" height="720" fill={`url(#castle_sky${idSuffix})`} />

      {/* 2. SUN / MOON */}
      {showSun && (
        <circle
          cx={theme.sunPos[0]}
          cy={theme.sunPos[1]}
          r={mood === "night" ? 180 : 260}
          fill={`url(#castle_sun${idSuffix})`}
        />
      )}

      {/* 3. DISTANT MOUNTAINS */}
      {showMountains && (
        <g>
          {/* Far Mountains */}
          <path
            d="M 0 420 L 110 332 L 210 393 L 305 320 L 432 399 L 530 340 L 655 410 L 750 333 L 860 415 L 980 325 L 1090 390 L 1280 312 V 600 H 0 Z"
            fill={theme.mountains[0]}
            opacity="0.6"
          />
          {/* Mid Mountains */}
          <path
            d="M 0 495 L 170 400 L 310 461 L 500 377 L 650 460 L 820 385 L 980 452 L 1130 388 L 1280 430 V 620 H 0 Z"
            fill={theme.mountains[1]}
            opacity="0.75"
          />
        </g>
      )}

      {/* 4. CASTLE FORTRESS WALL */}
      {showWall && (
        <g opacity="0.98">
          {/* Wall Body */}
          <rect
            x="48"
            y="180"
            width="1180"
            height="390"
            fill={`url(#castle_wall${idSuffix})`}
            stroke="#4a3728"
            strokeWidth="8"
          />
          <rect
            x="48"
            y="180"
            width="1180"
            height="390"
            fill={`url(#castle_brick${idSuffix})`}
          />

          {/* Wall Top Parapet Line */}
          <path d="M 42 170 H 1230 V 205 H 42 Z" fill="#6d543e" />

          {/* Crenels / Battlements */}
          <g fill="#9c7e5a" stroke="#483626" strokeWidth="5">
            <rect x="45" y="135" width="94" height="70" />
            <rect x="186" y="135" width="94" height="70" />
            <rect x="327" y="135" width="94" height="70" />
            <rect x="468" y="135" width="94" height="70" />
            <rect x="609" y="135" width="94" height="70" />
            <rect x="750" y="135" width="94" height="70" />
            <rect x="891" y="135" width="94" height="70" />
            <rect x="1032" y="135" width="94" height="70" />
            <rect x="1173" y="135" width="60" height="70" />
          </g>

          {/* Arched Arrow-Slit Windows */}
          <g fill="#1f2329" stroke="#876f55" strokeWidth="8">
            <path d="M 240 410 V 290 Q 290 235 340 290 V 410 Z" />
            <path d="M 944 410 V 290 Q 994 235 1044 290 V 410 Z" />
          </g>

          {/* Window Bars */}
          <g stroke="#4a3c30" strokeWidth="4">
            <line x1="290" y1="260" x2="290" y2="410" />
            <line x1="260" y1="340" x2="320" y2="340" />
            <line x1="994" y1="260" x2="994" y2="410" />
            <line x1="964" y1="340" x2="1024" y2="340" />
          </g>
        </g>
      )}

      {/* 5. CASTLE GATE PORTAL */}
      {showGate && (
        <g>
          {/* Stone Arch Outer Frame */}
          <path
            d="M 540 570 V 350 Q 640 240 740 350 V 570"
            fill="#3e3633"
            stroke="#5c3f2b"
            strokeWidth="18"
          />
          {/* Inner Arch Void */}
          <path
            d="M 565 570 V 355 Q 640 280 715 355 V 570"
            fill="#2c2522"
          />

          {/* Heavy Wooden Gate Doors */}
          <path
            d="M 592 570 V 471 Q 640 427 689 471 V 570"
            fill="#5a3b22"
            stroke="#2e241f"
            strokeWidth="8"
          />
          {/* Iron Door Bands */}
          <path d="M 595 495 H 688 M 595 530 H 688" stroke="#8c6437" strokeWidth="7" />
          {/* Brass Ring Handle */}
          <circle cx="643" cy="515" r="10" fill="#c49f4f" />
        </g>
      )}

      {/* 6. COBBLESTONE GROUND */}
      <path
        d="M 0 540 Q 480 515 1280 540 V 720 H 0 Z"
        fill={`url(#castle_ground${idSuffix})`}
      />
      <path
        d="M 0 625 Q 460 570 1280 645"
        fill="none"
        stroke="#4a423a"
        strokeWidth="6"
        opacity="0.35"
      />

      {/* Cobblestones detail */}
      <g opacity="0.4" fill="#4d4439">
        <path d="M 100 575 L 230 599 L 195 618 L 77 600 Z" />
        <path d="M 770 605 L 940 622 L 900 649 L 745 631 Z" />
        <path d="M 300 660 L 445 647 L 483 672 L 323 687 Z" />
      </g>

      {/* 7. WALL FLUTTERING FLAG */}
      {showFlag && (
        <g id="castle_flag">
          {/* Flagpole */}
          <path d="M 188 140 V 44" stroke="#3b322b" strokeWidth="7" strokeLinecap="round" />
          {/* Finial gold ball */}
          <circle cx="188" cy="44" r="5" fill="#f2c85e" />
          {/* Flag Cloth with dynamic wave */}
          <path
            d={`M 188 49
                Q ${238 + flagWave1} ${30 + flagWave2} 294 61
                L 278 114
                Q ${230 + flagWave1} ${88 + flagWave2} 188 102
                Z`}
            fill={flagColor}
            stroke="#631b11"
            strokeWidth="4"
          />
          {/* Emblem Diamond */}
          <polygon
            points={`
              ${232 + flagWave1 * 0.6},${62 + flagWave2 * 0.5}
              ${248 + flagWave1 * 0.7},${82 + flagWave2 * 0.5}
              ${231 + flagWave1 * 0.6},${101 + flagWave2 * 0.5}
              ${217 + flagWave1 * 0.5},${81 + flagWave2 * 0.5}
            `}
            fill={flagEmblemColor}
          />
        </g>
      )}

      {/* 8. WALL TORCHES (Left & Right of gate) */}
      <g id="torches">
        {/* Left Torch */}
        <circle cx="510" cy="380" r={65 * torchLight1} fill={`url(#torch_glow${idSuffix})`} />
        <rect x="506" y="380" width="8" height="22" rx="2" fill="#4d321d" />
        <path
          d={`M 510 380 Q ${506 + Math.sin(frame * 0.5) * 3} 366 510 ${360 + Math.cos(frame * 0.4) * 3} Q ${514 + Math.cos(frame * 0.5) * 3} 366 510 380 Z`}
          fill="#ff9800"
        />
        <circle cx="510" cy="372" r="3" fill="#fff59d" />

        {/* Right Torch */}
        <circle cx="770" cy="380" r={65 * torchLight2} fill={`url(#torch_glow${idSuffix})`} />
        <rect x="766" y="380" width="8" height="22" rx="2" fill="#4d321d" />
        <path
          d={`M 770 380 Q ${766 + Math.sin(frame * 0.45) * 3} 366 770 ${360 + Math.cos(frame * 0.35) * 3} Q ${774 + Math.cos(frame * 0.45) * 3} 366 770 380 Z`}
          fill="#ff9800"
        />
        <circle cx="770" cy="372" r="3" fill="#fff59d" />
      </g>

      {/* 9. CHARACTERS & FOREGROUND OBJECTS (Injected as children) */}
      {children}

      {/* 10. MOOD TINT OVERLAY */}
      <rect
        width="1280"
        height="720"
        fill={theme.tintColor}
        opacity={theme.tintOpacity}
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
};

