import { useEffect, useState } from "react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIOS()) {
      toast.info("En iPhone: abre el menú Compartir de Safari y pulsa «Añadir a pantalla de inicio».");
    } else {
      toast.info("Abre el menú del navegador y pulsa «Instalar app» o «Añadir a pantalla de inicio».");
    }
  };

  return (
    <button
      onClick={install}
      className="flex w-full items-center justify-between border border-foreground bg-background px-4 py-3 text-left transition-colors hover:bg-secondary"
    >
      <div>
        <p className="font-display text-lg italic leading-tight">Instalar Cardex</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          App en tu móvil · Android e iOS
        </p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
        Instalar →
      </span>
    </button>
  );
}
