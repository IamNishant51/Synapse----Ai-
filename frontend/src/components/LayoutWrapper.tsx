"use client";

import { usePathname } from "next/navigation";
import NavRail from "./NavRail";
import { IngestionProvider } from "@/context/IngestionContext";
import { ChatProvider } from "@/context/ChatContext";
import { ToastProvider } from "@/context/ToastContext";
import { AIConfigProvider } from "@/context/AIConfigContext";
import AIConfigModal from "./AIConfigModal";
import CogneeConsole from "./CogneeConsole";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isLogin = pathname === "/login";

  if (isLanding || isLogin) {
    return (
      <IngestionProvider>
        <ToastProvider>
          <div className="w-full relative">{children}</div>
        </ToastProvider>
      </IngestionProvider>
    );
  }

  return (
    <IngestionProvider>
      <ChatProvider>
        <ToastProvider>
          <AIConfigProvider>
            <div className="h-full w-full relative">
              <NavRail />
              <main className="h-full w-full pb-16 md:pb-0 md:pl-60 relative overflow-hidden">
                {children}
              </main>
              <AIConfigModal />
              <CogneeConsole />
            </div>
          </AIConfigProvider>
        </ToastProvider>
      </ChatProvider>
    </IngestionProvider>
  );
}
