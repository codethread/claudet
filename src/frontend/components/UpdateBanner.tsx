import { useEffect, useState } from "react";
import { Button } from "./ui/button";

/**
 * UpdateBanner Component
 *
 * Displays a notification when a service worker update is available.
 * Allows users to refresh the page to activate the new version.
 */
export function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );

  useEffect(() => {
    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Check for updates on load
    const checkForUpdates = async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;

      // Check if there's a waiting worker
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }

      // Listen for new service worker installing
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New service worker installed, show update banner
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    };

    checkForUpdates();

    // Listen for controller change (when new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (!waitingWorker) return;

    // Tell the waiting service worker to skip waiting
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setShowUpdate(false);
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 dark:bg-blue-700 text-white p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">Update Available</p>
          <p className="text-sm text-blue-100 dark:text-blue-200">
            A new version of this app is ready to install.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="bg-transparent border-white text-white hover:bg-white/10"
          >
            Later
          </Button>
          <Button
            onClick={handleUpdate}
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
