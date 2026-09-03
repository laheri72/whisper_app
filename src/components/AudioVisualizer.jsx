import React, { useEffect, useRef } from 'react';

export const AudioVisualizer = ({ analyser, isRecording, className = "h-24" }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const smoothedHeightsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numBars = 32;
    let dataArray = new Uint8Array(numBars);

    // Initialize smoothed values array
    if (!smoothedHeightsRef.current || smoothedHeightsRef.current.length !== numBars) {
      smoothedHeightsRef.current = new Array(numBars).fill(6);
    }

    let phase = 0;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      phase += 0.05;

      if (analyser && isRecording) {
        const binCount = analyser.frequencyBinCount;
        const rawData = new Uint8Array(binCount);
        analyser.getByteFrequencyData(rawData);

        // Group frequency bins into numBars
        const step = Math.max(1, Math.floor(binCount / numBars));
        for (let i = 0; i < numBars; i++) {
          let sum = 0;
          let count = 0;
          for (let j = 0; j < step && i * step + j < binCount; j++) {
            sum += rawData[i * step + j];
            count++;
          }
          dataArray[i] = count > 0 ? sum / count : 0;
        }
      } else if (isRecording) {
        // Subtle organic breathing wave when microphone is active but analyser not connected yet
        for (let i = 0; i < numBars; i++) {
          const wave = Math.sin(phase + (i * 0.3)) * 0.5 + 0.5;
          dataArray[i] = Math.floor(wave * 35) + 15;
        }
      } else {
        // Flat resting state
        dataArray.fill(4);
      }

      // Smooth bar interpolation across frames to prevent jitter / flickering
      const smoothed = smoothedHeightsRef.current;
      const barWidth = (width / numBars) * 0.75;
      const spacing = (width - (numBars * barWidth)) / (numBars + 1);

      let x = spacing;

      for (let i = 0; i < numBars; i++) {
        // Target height calculation based on real volume
        const targetHeight = isRecording
          ? Math.max(6, (dataArray[i] / 255) * height * 0.85)
          : 4;

        // Exponential smoothing (lerp)
        smoothed[i] += (targetHeight - smoothed[i]) * 0.25;
        const currentBarHeight = smoothed[i];

        // Gradient styling
        const gradient = ctx.createLinearGradient(0, height, 0, height - currentBarHeight);
        if (isRecording) {
          gradient.addColorStop(0, '#D97706'); // amber-600
          gradient.addColorStop(0.5, '#F59E0B'); // amber-500
          gradient.addColorStop(1, '#FDE68A'); // amber-200
        } else {
          gradient.addColorStop(0, '#334E68');
          gradient.addColorStop(1, '#627D98');
        }

        ctx.fillStyle = gradient;

        // Center vertically
        const y = (height - currentBarHeight) / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, Math.max(2, barWidth), currentBarHeight, 3);
        } else {
          ctx.rect(x, y, Math.max(2, barWidth), currentBarHeight);
        }
        ctx.fill();

        x += barWidth + spacing;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isRecording]);

  return (
    <div className={`relative w-full rounded-xl bg-slate-900/80 border border-gold-500/20 p-3 overflow-hidden flex flex-col justify-center items-center ${className}`}>
      <canvas 
        ref={canvasRef} 
        width={480} 
        height={100} 
        className="w-full h-full object-cover"
      />
      {isRecording && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          AUDIO STREAM ACTIVE
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
