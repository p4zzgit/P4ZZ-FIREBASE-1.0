import React, { useEffect, useRef } from 'react';

export const LoginEffects = ({ effect, color }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (effect === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', resize);
    resize();

    // --- EFFECTS LOGIC ---

    // 1. Particles
    const particles = [];
    if (effect === 'particles') {
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 1,
          speedX: Math.random() * 1 - 0.5,
          speedY: Math.random() * 1 - 0.5,
          opacity: Math.random() * 0.5 + 0.2
        });
      }
    }

    // 2. Stars
    const stars = [];
    if (effect === 'stars') {
      for (let i = 0; i < 200; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.5,
          speed: Math.random() * 0.05 + 0.01
        });
      }
    }

    // 3. Rain
    const drops = [];
    if (effect === 'rain') {
      for (let i = 0; i < 100; i++) {
        drops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: Math.random() * 20 + 10,
          speed: Math.random() * 5 + 2
        });
      }
    }

    // 4. Matrix
    const columns = Math.floor(width / 20);
    const matrixDrops = [];
    if (effect === 'matrix') {
      for (let i = 0; i < columns; i++) {
        matrixDrops[i] = Math.random() * -100;
      }
    }

    // 5. Aurora
    let auroraTime = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (effect === 'particles') {
        ctx.fillStyle = color;
        particles.forEach(p => {
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        });
      }

      if (effect === 'stars') {
        ctx.fillStyle = color;
        stars.forEach(s => {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          s.y += s.speed;
          if (s.y > height) s.y = 0;
        });
      }

      if (effect === 'rain') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        drops.forEach(d => {
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y + d.length);
          ctx.stroke();
          d.y += d.speed;
          if (d.y > height) {
            d.y = -d.length;
            d.x = Math.random() * width;
          }
        });
      }

      if (effect === 'matrix') {
        ctx.fillStyle = color;
        ctx.font = '15px monospace';
        ctx.globalAlpha = 0.6;
        matrixDrops.forEach((y, i) => {
          const text = String.fromCharCode(Math.random() * 128);
          ctx.fillText(text, i * 20, y * 20);
          if (y * 20 > height && Math.random() > 0.975) {
            matrixDrops[i] = 0;
          }
          matrixDrops[i]++;
        });
      }

      if (effect === 'aurora') {
        auroraTime += 0.005;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x < width; x += 10) {
            const y = height * 0.7 + Math.sin(x * 0.002 + auroraTime + i) * 100 + Math.cos(x * 0.005 + auroraTime) * 50;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
          gradient.addColorStop(0, 'transparent');
          gradient.addColorStop(1, color + '33'); // Add some transparency
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      if (effect === 'cyber') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.2;
        const spacing = 40;
        const time = Date.now() * 0.02;
        
        // Horizontal lines
        for (let y = 0; y < height; y += spacing) {
          const offset = (time + y) % spacing;
          ctx.beginPath();
          ctx.moveTo(0, y + offset);
          ctx.lineTo(width, y + offset);
          ctx.stroke();
        }
        
        // Vertical lines
        for (let x = 0; x < width; x += spacing) {
          const offset = (time + x) % spacing;
          ctx.beginPath();
          ctx.moveTo(x + offset, 0);
          ctx.lineTo(x + offset, height);
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [effect, color]);

  if (effect === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
