import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/dashboard-mensual", { replace: true });
  }, [navigate]);

  return null;
}
