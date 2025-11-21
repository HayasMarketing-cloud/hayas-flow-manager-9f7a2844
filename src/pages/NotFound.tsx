import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Página no encontrada</p>
        <Button onClick={() => navigate("/dashboard-mensual")}>Volver al inicio</Button>
      </div>
    </div>
  );
}
