// src/components/VoiceSphere.jsx
import React, { useEffect, useRef } from 'react';

export default function VoiceSphere({ isRecording, volume, onClick }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const rotationRef = useRef({ x: 0.3, y: 0.5, z: 0.1 });
  const timeRef = useRef(0);

  // Guarantee volume is a safe number
  const vol = typeof volume === 'number' && !isNaN(volume) ? volume : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Always use fixed internal coordinates (400x400) to prevent layout collapse glitches
    const width = 400;
    const height = 400;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const radius = 100;
    const latBands = 18;
    const lonBands = 24;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Rotation multiplier: still when idle, slow and elegant when speaking
      const speedMultiplier = isRecording ? (0.02 + vol * 0.08) : 0.0;
      rotationRef.current.y += 0.08 * speedMultiplier;
      rotationRef.current.x += 0.03 * speedMultiplier;
      
      timeRef.current += isRecording ? (0.05 + vol * 0.1) : 0.0;

      // Draw dynamic pulsing radial glow core
      if (isRecording) {
        const coreGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius * 0.9);
        coreGlow.addColorStop(0, `rgba(99, 102, 241, ${0.2 + vol * 0.2})`);
        coreGlow.addColorStop(0.5, `rgba(168, 85, 247, ${0.08 + vol * 0.1})`);
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.1, 0, 2 * Math.PI);
        ctx.fill();
      }

      const points = [];
      
      for (let lat = 0; lat <= latBands; lat++) {
        const theta = (lat * Math.PI) / latBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const row = [];

        for (let lon = 0; lon <= lonBands; lon++) {
          const phi = (lon * 2 * Math.PI) / lonBands;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          // Subtle wave distortion based on audio
          const waveFreq = 4.0;
          const waveSpeed = timeRef.current;
          const waveMag = isRecording ? (3 + vol * 18) : 0;
          const r = radius + (isRecording ? Math.sin(theta * waveFreq + waveSpeed) * Math.cos(phi * waveFreq + waveSpeed) * waveMag : 0);

          let x = r * sinTheta * cosPhi;
          let y = r * cosTheta;
          let z = r * sinTheta * sinPhi;

          // X rotation
          const cosX = Math.cos(rotationRef.current.x);
          const sinX = Math.sin(rotationRef.current.x);
          let y1 = y * cosX - z * sinX;
          let z1 = y * sinX + z * cosX;

          // Y rotation
          const cosY = Math.cos(rotationRef.current.y);
          const sinY = Math.sin(rotationRef.current.y);
          let x2 = x * cosY - z1 * sinY;
          let z2 = x * sinY + z1 * cosY;

          const perspective = 300 / (300 + z2);
          row.push({
            x: cx + x2 * perspective,
            y: cy + y1 * perspective,
            z: z2,
            perspective
          });
        }
        points.push(row);
      }

      ctx.lineWidth = 1.2;

      // Color shifting configuration for speaking state (cycles hues)
      const baseHue = (timeRef.current * 15) % 360;

      // Draw latitudinal grid lines
      for (let lat = 0; lat <= latBands; lat++) {
        for (let lon = 0; lon < lonBands; lon++) {
          const p1 = points[lat][lon];
          const p2 = points[lat][lon + 1];

          const avgZ = (p1.z + p2.z) / 2;
          const maxZ = radius + 30;
          let opacity = (maxZ - avgZ) / (2 * maxZ);
          opacity = Math.max(0.08, Math.min(0.9, opacity));

          if (isRecording) {
            // Colors shift dynamically on speaking
            ctx.strokeStyle = `hsla(${baseHue}, 75%, 65%, ${opacity * (0.65 + vol * 0.35)})`;
          } else {
            ctx.strokeStyle = `rgba(229, 231, 235, ${opacity * 0.45})`; // Stable bright white/gray
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Draw longitudinal grid lines
      for (let lon = 0; lon <= lonBands; lon++) {
        for (let lat = 0; lat < latBands; lat++) {
          const p1 = points[lat][lon];
          const p2 = points[lat + 1][lon];

          const avgZ = (p1.z + p2.z) / 2;
          const maxZ = radius + 30;
          let opacity = (maxZ - avgZ) / (2 * maxZ);
          opacity = Math.max(0.08, Math.min(0.9, opacity));

          if (isRecording) {
            ctx.strokeStyle = `hsla(${(baseHue + 40) % 360}, 75%, 65%, ${opacity * (0.65 + vol * 0.35)})`;
          } else {
            ctx.strokeStyle = `rgba(156, 163, 175, ${opacity * 0.35})`;
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Draw intersecting glowing nodes
      for (let lat = 0; lat <= latBands; lat += 2) {
        for (let lon = 0; lon < lonBands; lon += 2) {
          const p = points[lat][lon];
          const maxZ = radius + 30;
          let opacity = (maxZ - p.z) / (2 * maxZ);
          opacity = Math.max(0.1, Math.min(0.95, opacity));
          const nodeRadius = 1.8 * p.perspective;

          if (isRecording) {
            ctx.fillStyle = `hsla(${(baseHue + 80) % 360}, 90%, 85%, ${opacity * (0.8 + vol * 0.2)})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.6})`;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, nodeRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, vol]);

  return (
    <div 
      className="relative w-[220px] h-[220px] xs:w-[260px] xs:h-[260px] sm:w-[300px] sm:h-[300px] md:w-[320px] md:h-[320px] flex items-center justify-center cursor-pointer rounded-full transition-transform duration-500 hover:scale-[1.03]"
      onClick={onClick}
    >
      {/* Glow Backing */}
      <div 
        className={`absolute w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-full filter blur-[24px] sm:blur-[32px] pointer-events-none transition-all duration-[800ms] ${
          isRecording 
            ? 'bg-gradient-to-tr from-indigo-500/40 to-purple-500/30 scale-125 opacity-100' 
            : 'bg-gradient-to-tr from-indigo-500/15 to-purple-500/10 scale-100 opacity-60'
        }`} 
      />
      
      {/* 3D Wireframe Canvas */}
      <canvas ref={canvasRef} className="relative z-10 w-full h-full pointer-events-none" />
      
      {/* Action Overlay */}
      <div className="absolute z-20 flex flex-col items-center justify-center">
        <span 
          className={`font-heading text-[0.68rem] md:text-xs font-bold tracking-[0.18em] px-4 py-2 rounded-full border bg-[#04060a]/95 backdrop-blur-md select-none transition-all duration-300 ${
            isRecording 
              ? 'text-indigo-400 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
              : 'text-gray-300 border-white/5 hover:text-white hover:border-white/20'
          }`}
        >
          {isRecording ? 'TAP TO STOP' : 'TAP TO TALK'}
        </span>
      </div>
    </div>
  );
}
