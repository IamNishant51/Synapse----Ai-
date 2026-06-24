"use client";

import { usePathname } from "next/navigation";
import NavRail from "./NavRail";
import { IngestionProvider } from "@/context/IngestionContext";
import { ChatProvider } from "@/context/ChatContext";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return (
      <IngestionProvider>
        <div className="w-full relative">{children}</div>
      </IngestionProvider>
    );
  }

  return (
    <IngestionProvider>
      <ChatProvider>
        <div className="h-full w-full relative">
          <NavRail />
          <main className="h-full w-full pb-16 md:pb-0 md:pl-60 relative overflow-hidden">
            {children}
          </main>
        </div>
      </ChatProvider>
    </IngestionProvider>
  );
}
