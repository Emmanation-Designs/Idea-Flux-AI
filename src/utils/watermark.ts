/**
 * Professional Image Watermarking Engine for Trelvix AI.
 * Programmatically overlays a sleek brand capsule badge onto a proxy-friendly image via HTML5 Canvas.
 */
export const applyWatermark = (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve('');
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        // 1. Draw the primary generated image
        ctx.drawImage(img, 0, 0);

        // Set opacity for the watermark layer to look beautifully transparent and professional at exactly 50%
        ctx.globalAlpha = 0.50;

        // 2. Prepare proportional styling multipliers
        const width = img.width;
        const height = img.height;
        const scale = Math.max(0.6, Math.min(1.6, width / 1024));

        const padding = 24 * scale;
        const badgeHeight = 36 * scale;
        const badgeWidth = 145 * scale;
        const badgeX = width - badgeWidth - padding;
        const badgeY = height - badgeHeight - padding;

        // 3. Configure elegant drop-shadow on the element directly so it remains highly legible on any picture backdrops
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 4 * scale;
        ctx.shadowOffsetX = 1 * scale;
        ctx.shadowOffsetY = 1 * scale;

        // 4. Render Custom Brand Zap Icon Logo directly without any dark background capsule container
        const contentLeftX = badgeX + 15 * scale;
        const centerY = badgeY + badgeHeight / 2;
        const zapSize = 16 * scale;
        const zapX = contentLeftX;
        const zapY = centerY - zapSize / 2;

        const zapGradient = ctx.createLinearGradient(zapX, zapY, zapX + zapSize, zapY + zapSize);
        zapGradient.addColorStop(0, '#38bdf8'); // sky-400 (bright, clean, vibrant)
        zapGradient.addColorStop(1, '#c084fc'); // purple-400

        ctx.fillStyle = zapGradient;
        ctx.beginPath();
        // Dynamic mathematically-proportioned vector coordinates mimicking WelcomeScreen's Zap
        ctx.moveTo(zapX + zapSize * 0.58, zapY + zapSize * 0.08); 
        ctx.lineTo(zapX + zapSize * 0.22, zapY + zapSize * 0.54); 
        ctx.lineTo(zapX + zapSize * 0.48, zapY + zapSize * 0.54); 
        ctx.lineTo(zapX + zapSize * 0.38, zapY + zapSize * 0.92); 
        ctx.lineTo(zapX + zapSize * 0.76, zapY + zapSize * 0.44); 
        ctx.lineTo(zapX + zapSize * 0.50, zapY + zapSize * 0.44); 
        ctx.closePath();
        ctx.fill();

        // 5. Draw "Trelvix AI" Typography Branding directly
        const fontSize = Math.round(11.5 * scale);
        ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // High contrast pure white text color
        ctx.fillStyle = '#ffffff'; 
        
        const textX = zapX + zapSize + 8 * scale;
        ctx.fillText('Trelvix AI', textX, centerY + 0.5 * scale);

        // Reset shadow defaults
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 9. Output resulting high-fidelity data URL string
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('[Watermark] Failed compiling watermark onto canvas:', err);
        resolve(imageUrl); // Safe resilient fallback
      }
    };

    img.onerror = (err) => {
      console.error('[Watermark] Image load failed for rendering:', err);
      resolve(imageUrl); // Safe resilient fallback
    };

    // Begin drawing operation
    img.src = imageUrl;
  });
};
