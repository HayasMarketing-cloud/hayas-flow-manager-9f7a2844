import { useEffect, useState } from 'react';
import flowManagerLogo from '@/assets/flowmanager-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
  minDisplayTime?: number;
}

export function SplashScreen({ onComplete, minDisplayTime = 1500 }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500); // Wait for fade animation
    }, minDisplayTime);

    return () => clearTimeout(timer);
  }, [onComplete, minDisplayTime]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, hsl(var(--hayas-green)) 0%, hsl(var(--deep-teal)) 50%, hsl(var(--deep-blue)) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Logo con animación */}
        <div className={`transition-all duration-700 ${fadeOut ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
          <img
            src={flowManagerLogo}
            alt="Flow Manager"
            className="h-24 w-auto brightness-0 invert drop-shadow-2xl animate-pulse"
          />
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="h-2 w-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>

        {/* Texto */}
        <p className="text-white/70 text-sm font-medium tracking-wide">
          Cargando...
        </p>
      </div>
    </div>
  );
}
