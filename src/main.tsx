import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        const notifyWaiting = (worker: ServiceWorker) => {
          window.dispatchEvent(new CustomEvent("meco-update-ready", { detail: worker }));
        };

        // New SW already waiting when page loads (e.g. user had the tab open during a deploy)
        if (registration.waiting) {
          notifyWaiting(registration.waiting);
        }

        // New SW found during this session
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyWaiting(newWorker);
            }
          });
        });

        // On mobile PWAs the page stays alive in memory when backgrounded.
        // The "load" event never fires again on re-open, so we must explicitly
        // poll for a new SW whenever the app becomes visible.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => undefined);
            // If a SW finished installing while we were in the background,
            // it will already be in "waiting" — notify immediately.
            if (registration.waiting) {
              notifyWaiting(registration.waiting);
            }
          }
        });
      })
      .catch(() => {
        // Silently ignore SW registration errors
      });

    // When the new SW takes control, reload so the fresh assets are used
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
