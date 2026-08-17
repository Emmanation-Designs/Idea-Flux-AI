import React, { useEffect, useRef } from 'react';

interface LiveVoiceOrbProps {
  status: 'idle' | 'connecting' | 'listening' | 'user_speaking' | 'thinking' | 'searching' | 'ai_speaking' | 'muted' | 'error';
  userVolume?: number; // 0..1
  aiVolume?: number;   // 0..1
  size?: number;
}

export const LiveVoiceOrb: React.FC<LiveVoiceOrbProps> = ({
  status,
  userVolume = 0,
  aiVolume = 0,
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = (size / 2) * 0.72;

      phase += 0.035;

      // Active volume dynamics
      let currentVol = 0;
      let primaryColor = '#19C37D';
      let secondaryColor = '#10b981';
      let lightAccent = '#ffffff';

      if (status === 'user_speaking') {
        currentVol = Math.max(userVolume, 0.25);
        primaryColor = '#19C37D';
        secondaryColor = '#34d399';
      } else if (status === 'ai_speaking') {
        currentVol = Math.max(aiVolume, 0.35);
        primaryColor = '#10b981';
        secondaryColor = '#059669';
      } else if (status === 'thinking') {
        currentVol = 0.15;
        primaryColor = '#14b8a6';
        secondaryColor = '#0d9488';
      } else if (status === 'searching') {
        currentVol = 0.22 + Math.sin(phase * 3.0) * 0.08;
        primaryColor = '#06b6d4';
        secondaryColor = '#0284c7';
      } else if (status === 'muted') {
        currentVol = 0.02;
        primaryColor = '#64748b';
        secondaryColor = '#475569';
      } else if (status === 'error') {
        currentVol = 0.1;
        primaryColor = '#ef4444';
        secondaryColor = '#dc2626';
      } else {
        // Idle/listening breathing state
        currentVol = 0.08 + Math.sin(phase * 1.5) * 0.04;
      }

      // 1. Draw outer soft ambient glow aura
      const auraGradient = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.4,
        centerX, centerY, baseRadius * 1.6 + currentVol * 30
      );
      auraGradient.addColorStop(0, 'rgba(25, 195, 125, 0.35)');
      auraGradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.18)');
      auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.6 + currentVol * 30, 0, Math.PI * 2);
      ctx.fillStyle = auraGradient;
      ctx.fill();

      // 2. Draw organic fluid boundary with fluid waves
      const pointsCount = 64;
      ctx.beginPath();
      for (let i = 0; i <= pointsCount; i++) {
        const angle = (i / pointsCount) * Math.PI * 2;

        // Wave harmonics
        const freq1 = Math.sin(angle * 3 + phase) * (6 + currentVol * 28);
        const freq2 = Math.cos(angle * 5 - phase * 1.3) * (4 + currentVol * 16);
        const freq3 = Math.sin(angle * 7 + phase * 0.7) * (2 + currentVol * 10);
        const radius = baseRadius + freq1 + freq2 + freq3;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Fluid vertical/diagonal gradient matching Image 2 (green on top, bright soft white cloud on bottom)
      const fluidGradient = ctx.createLinearGradient(
        centerX, centerY - baseRadius,
        centerX, centerY + baseRadius
      );
      fluidGradient.addColorStop(0, primaryColor);
      fluidGradient.addColorStop(0.35, secondaryColor);
      fluidGradient.addColorStop(0.68, '#d1fae5');
      fluidGradient.addColorStop(1, lightAccent);

      ctx.fillStyle = fluidGradient;
      ctx.shadowColor = 'rgba(25, 195, 125, 0.5)';
      ctx.shadowBlur = 30 + currentVol * 25;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 3. Draw internal soft cloud mist / light flow inside the orb
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= pointsCount; i++) {
        const angle = (i / pointsCount) * Math.PI * 2;
        const freq = Math.sin(angle * 3 + phase) * (6 + currentVol * 28);
        const radius = baseRadius + freq;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();

      // Internal fluid swirl
      const innerGlow = ctx.createRadialGradient(
        centerX + Math.cos(phase * 0.8) * 20,
        centerY + baseRadius * 0.35 + Math.sin(phase) * 15,
        10,
        centerX,
        centerY + baseRadius * 0.3,
        baseRadius * 0.95
      );
      innerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      innerGlow.addColorStop(0.45, 'rgba(255, 255, 255, 0.4)');
      innerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY + baseRadius * 0.3, baseRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, userVolume, aiVolume, size]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={size * 1.5}
        height={size * 1.5}
        className="pointer-events-none"
        style={{ width: size, height: size }}
      />
    </div>
  );
};
