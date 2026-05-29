import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const cleanupLegacyServiceWorkers = async () => {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }
  } catch (error) {
    console.warn("Could not clean legacy service worker caches", error);
  }
};

void cleanupLegacyServiceWorkers();

createRoot(document.getElementById("root")!).render(<App />);
