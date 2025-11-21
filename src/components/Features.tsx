import { Zap, Shield, Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Zap,
    title: "Súper rápido",
    description: "Optimizado para el mejor rendimiento con las últimas tecnologías web.",
  },
  {
    icon: Shield,
    title: "Seguro y confiable",
    description: "Construido con las mejores prácticas de seguridad desde el principio.",
  },
  {
    icon: Palette,
    title: "Diseño moderno",
    description: "Interfaz elegante y responsive que se adapta a cualquier dispositivo.",
  },
];

export const Features = () => {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
            Todo lo que necesitas
          </h2>
          <p className="text-lg text-muted-foreground">
            Características pensadas para una experiencia excepcional
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="group border-border/50 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
