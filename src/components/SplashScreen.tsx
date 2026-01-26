import { useEffect, useState } from 'react';

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Icono con animación */}
        <div className={`transition-all duration-700 ${fadeOut ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
          <img
            src="/icons/icon-512x512.png"
            alt="Flow Manager"
            className="h-32 w-32 drop-shadow-xl animate-pulse rounded-3xl"
          />
        </div>

        {/* Loading indicator con colores del gradiente */}
        <div className="flex items-center gap-2">
          <div className="flex space-x-1.5">
            <div 
              className="h-2.5 w-2.5 rounded-full animate-bounce" 
              style={{ backgroundColor: 'hsl(var(--hayas-green))', animationDelay: '0ms' }} 
            />
            <div 
              className="h-2.5 w-2.5 rounded-full animate-bounce" 
              style={{ backgroundColor: 'hsl(var(--deep-teal))', animationDelay: '150ms' }} 
            />
            <div 
              className="h-2.5 w-2.5 rounded-full animate-bounce" 
              style={{ backgroundColor: 'hsl(var(--deep-blue))', animationDelay: '300ms' }} 
            />
          </div>
        </div>

        {/* Texto */}
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          Cargando...
        </p>
      </div>
    </div>
  );
}
