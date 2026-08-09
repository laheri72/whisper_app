import React, { useEffect, useRef } from 'react';

export const AudioVisualizer = ({ analyser, isRecording, className = "h-24" }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bufferLength = 32;
    let dataArray = new Uint8Array(bufferLength);

    if (analyser) {
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isRecording) {
        analyser.getByteFrequencyData(dataArray);
      } else if (isRecording) {
        // Fallback simulation if analyser node is warming up
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(Math.random() * 180) + 40;
        }
      } else {
        dataArray.fill(4); // ambient flat state
      }

      const barWidth = (width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height * 0.85;
        barHeight = Math.max(barHeight, 4);

        // Gold & Cyan gradient fill for academic feel
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        if (isRecording) {
          gradient.addColorStop(0, '#D97706');
          gradient.addColorStop(0.5, '#F59E0B');
          gradient.addColorStop(1, '#FDE68A');
        } else {
          gradient.addColorStop(0, '#334E68');
          gradient.addColorStop(1, '#627D98');
        }

        ctx.fillStyle = gradient;
        
        // Rounded bar caps
        const y = (height - barHeight) / 2; // centered vertically
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth - 3, barHeight, 4);
        } else {
          ctx.rect(x, y, barWidth - 3, barHeight);
        }
        ctx.fill();

        x += barWidth + 2;
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
        width={400} 
        height={100} 
        className="w-full h-full object-cover"
      />
      {isRecording && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          LIVE MICROPHONE INPUT
        </div>
      )}
    </div>
  );
};
