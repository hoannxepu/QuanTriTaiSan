import React from 'react';

interface PyramidLogoProps {
  className?: string;
}

export const PyramidLogo: React.FC<PyramidLogoProps> = ({ className = 'w-full h-full' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className={className}
      role="img"
      aria-label="Logo Tháp Tài Sản"
    >
      <defs>
        {/* Clean, Bright Corporate Background */}
        <linearGradient id="pyrBgBright" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>

        {/* Subtle Silver-Slate Border */}
        <linearGradient id="pyrBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Foundation Plinth: Deep Prestigious Navy */}
        <linearGradient id="pyrNavyLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="pyrNavyRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#172554" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* Mid Tier: Pure Emerald Green */}
        <linearGradient id="pyrEmeraldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="pyrEmeraldRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>

        {/* Apex Capstone: Prestigious Noble Gold */}
        <linearGradient id="pyrGoldLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="pyrGoldRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Natural Soft Shadow */}
        <filter id="pyrNaturalShadow" x="-10%" y="-10%" width="125%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.12" />
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Bright Squircle Badge Container */}
      <rect
        x="6"
        y="6"
        width="244"
        height="244"
        rx="52"
        fill="url(#pyrBgBright)"
        stroke="url(#pyrBorderGrad)"
        strokeWidth="2"
      />

      {/* Architectural Solid Wealth Pyramid */}
      <g filter="url(#pyrNaturalShadow)">
        {/* Base Plinth Foundation Ring */}
        <polygon points="128,214 36,168 128,154 220,168" fill="#e2e8f0" opacity="0.6" />

        {/* TẦNG 1: NỀN TẢNG BẢO VỆ */}
        <polygon points="128,206 42,162 42,136 128,178" fill="url(#pyrNavyLeft)" />
        <polygon points="128,206 214,162 214,136 128,178" fill="url(#pyrNavyRight)" />
        <polygon points="128,178 42,136 128,96 214,136" fill="#3b82f6" opacity="0.25" />

        {/* TẦNG 2: TĂNG TRƯỞNG & ĐẦU TƯ */}
        <polygon points="128,158 64,126 64,102 128,134" fill="url(#pyrEmeraldLeft)" />
        <polygon points="128,158 192,126 192,102 128,134" fill="url(#pyrEmeraldRight)" />
        <polygon points="128,134 64,102 128,70 192,102" fill="#10b981" opacity="0.3" />

        {/* TẦNG 3: ĐỈNH THÁP TỰ DO TÀI CHÍNH */}
        <polygon points="128,114 84,92 128,34" fill="url(#pyrGoldLeft)" />
        <polygon points="128,114 172,92 128,34" fill="url(#pyrGoldRight)" />

        {/* Sống trục trung tâm sắc nét */}
        <line x1="128" y1="34" x2="128" y2="114" stroke="#ffffff" strokeWidth="1.8" opacity="0.9" />
        <line x1="128" y1="134" x2="128" y2="158" stroke="#a7f3d0" strokeWidth="1.6" opacity="0.85" />
        <line x1="128" y1="178" x2="128" y2="206" stroke="#93c5fd" strokeWidth="1.6" opacity="0.85" />

        {/* Đỉnh tháp kim cương */}
        <polygon points="128,30 131,34 128,38 125,34" fill="#ffffff" />
      </g>
    </svg>
  );
};
