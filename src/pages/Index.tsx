import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen">
      <div className="absolute right-4 top-4 z-50">
        <Button onClick={() => navigate('/auth')} variant="outline">
          Iniciar Sesión
        </Button>
      </div>
      <Hero />
      <Features />
      <Footer />
    </div>
  );
};

export default Index;
