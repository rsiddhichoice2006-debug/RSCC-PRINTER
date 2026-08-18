import React from 'react';

interface RsccLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const RsccLogo: React.FC<RsccLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-[22px]',
    md: 'w-11 h-11 rounded-xl text-[30px]',
    lg: 'w-14 h-14 rounded-2xl text-[38px]',
    xl: 'w-20 h-20 rounded-2xl text-[54px]',
  };

  return (
    <div
      className={`relative bg-white border border-slate-200/80 shadow-xs flex items-center justify-center overflow-hidden shrink-0 select-none ${sizeClasses[size]} ${className}`}
      title="Riddhi Siddhi Choice Centre (RSCC)"
    >
      <svg viewBox="0 0 500 500" className="w-full h-full p-0.5">
        <rect width="500" height="500" rx="30" fill="#ffffff" />
        <g fontFamily="Georgia, 'Times New Roman', 'Playfair Display', serif" fontWeight="900">
          {/* Big Yellow R */}
          <text x="50%" y="430" fontSize="440" textAnchor="middle" fill="#FFDE00" letterSpacing="-10">
            R
          </text>
          {/* Red S on Top Left */}
          <text x="32%" y="280" fontSize="310" textAnchor="middle" fill="#E62129">
            S
          </text>
          {/* Navy Blue C on Top Right */}
          <text x="73%" y="270" fontSize="300" textAnchor="middle" fill="#1C2179">
            C
          </text>
          {/* Emerald Green C on Bottom Center */}
          <text x="49%" y="475" fontSize="310" textAnchor="middle" fill="#0A9448">
            C
          </text>
        </g>
      </svg>
    </div>
  );
};
