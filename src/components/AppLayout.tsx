import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TrialBanner } from "./TrialBanner";
import { TrialPopup } from "./TrialPopup";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-surface">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <TrialBanner />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-[1400px] p-6 animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <TrialPopup />
    </SidebarProvider>
  );
}
