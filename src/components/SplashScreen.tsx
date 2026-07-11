import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { TrelvixLogo } from './TrelvixLogo';

interface SplashScreenProps {
  isDarkMode: boolean;
  onComplete: () => void;
}

export const SplashScreen = ({ isDarkMode, onComplete }: SplashScreenProps) => {
  // Snappy, highly responsive total duration (3.0 seconds) to showcase the narrative beat:
  // 1. Sleek 360-degree rotation (entrance)
  // 2. Focused pause
  // 3. Move closer (scale forward)
  // 4. Subtle hold until the main screen presents itself
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.45, ease: [0.25, 1, 0.5, 1] } 
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden font-sans select-none pointer-events-none ${
        isDarkMode 
          ? 'bg-zinc-950 text-white' 
          : 'bg-white text-zinc-900'
      }`}
    >
      {/* High-performance CSS radial atmosphere gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className={`absolute inset-0 transition-opacity duration-1000 ${
            isDarkMode 
              ? 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_60%)]' 
              : 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_0%,transparent_60%)]'
          }`}
        />
      </div>

      {/* Main Core stage container */}
      <div className="relative flex flex-col items-center justify-center z-10">
        
        {/* Ambient background ring synchronized with the zoom beats */}
        <motion.div
          animate={{
            scale: [0.5, 1.0, 1.0, 1.15, 1.15],
            opacity: [0, 0.25, 0.25, 0.35, 0.35],
          }}
          transition={{
            duration: 3.0,
            times: [0, 0.4, 0.6, 0.8, 1.0],
            ease: ["easeOut", "linear", "easeInOut", "linear"],
          }}
          className={`absolute w-32 h-32 rounded-full pointer-events-none ${
            isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-500/5'
          }`}
        />

        {/* Outer subtle circular contour ring */}
        <motion.div
          animate={{
            scale: [0.5, 1.0, 1.0, 1.15, 1.15],
            opacity: [0, 0.15, 0.15, 0.2, 0.2],
          }}
          transition={{
            duration: 3.0,
            times: [0, 0.4, 0.6, 0.8, 1.0],
            ease: ["easeOut", "linear", "easeInOut", "linear"],
          }}
          className={`absolute w-24 h-24 rounded-full border pointer-events-none ${
            isDarkMode ? 'border-emerald-500/20' : 'border-emerald-500/10'
          }`}
        />

        {/* Center Logo with choregraphed rotation, pause, and step-closer timeline */}
        <motion.div
          animate={{
            scale: [0, 1.0, 1.0, 1.15, 1.15],
            rotate: [-360, 0, 0, 0, 0],
            opacity: [0, 1.0, 1.0, 1.0, 1.0],
          }}
          transition={{
            duration: 3.0,
            times: [0, 0.4, 0.6, 0.8, 1.0],
            ease: [
              "easeOut",      // 0.0 -> 0.4: Energetic spin & enter to native scale
              "linear",       // 0.4 -> 0.6: Focused static pause
              "easeInOut",    // 0.6 -> 0.8: Smooth forward focus step (move closer)
              "linear"        // 0.8 -> 1.0: Calm hold until app loads
            ],
          }}
          className="relative flex items-center justify-center p-4 transform-gpu"
        >
          <TrelvixLogo className="w-20 h-20" glow={true} />
        </motion.div>

      </div>
    </motion.div>
  );
};
