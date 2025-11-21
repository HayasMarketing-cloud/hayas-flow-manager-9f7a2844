import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Bienvenido a tu nueva aplicación
          </div>
          
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Construye algo{" "}
            <span className="text-gradient">increíble</span>
          </h1>
          
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Una aplicación web moderna construida con React y Tailwind CSS. 
            Rápida, elegante y lista para tus ideas.
          </p>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 shadow-glow">
              Comenzar ahora
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              Saber más
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
