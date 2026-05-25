import React from 'react';

interface TrelvixLogoProps {
  className?: string; // Tailwind class like "w-12 h-12"
  glow?: boolean;
}

export const TrelvixLogo = ({ className = "w-12 h-12", glow = true }: TrelvixLogoProps) => {
  return (
    <div className={`relative ${className} shrink-0 select-none flex items-center justify-center overflow-hidden`}>
      {/* 
        Masterfully crafted dual-mode logo renderer:
        - Dark Mode: Uses the original white logo on black, with `mix-blend-screen` to keep only the white logo.
        - Light Mode: Inverts the white logo on black to create a black logo on white, then uses `mix-blend-multiply` to keep only the black logo.
      */}
      
      {/* Dark mode logo */}
      <img
        referrerPolicy="no-referrer"
        src="/trelvixlogo.png"
        alt="Trelvix AI Logo"
        className={`hidden dark:block w-full h-full object-contain mix-blend-screen pointer-events-none ${
          glow ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : ''
        }`}
      />

      {/* Light mode logo */}
      <img
        referrerPolicy="no-referrer"
        src="/trelvixlogo.png"
        alt="Trelvix AI Logo"
        className="block dark:hidden w-full h-full object-contain invert mix-blend-multiply pointer-events-none"
      />
    </div>
  );
};
