import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { BookOpenText, FileStack, History, Info, LogOut, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: FileStack, label: "Documents", path: "/documents" },
  { icon: Sparkles, label: "Ask", path: "/ask" },
  { icon: History, label: "History", path: "/history" },
  { icon: Info, label: "About", path: "/about" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="canvas-glow grid-grain flex min-h-screen items-center justify-center p-5">
        <div className="enter-up glass-panel relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/85 p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-indigo-200/35 blur-3xl" />
          <div className="relative">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#202d59] text-white shadow-lg shadow-indigo-950/15"><BookOpenText className="size-5" /></div>
              <span className="text-lg font-extrabold tracking-[-0.04em] text-[#202d59]">DocuMind</span>
            </div>
            <p className="mono mb-4 text-[10px] font-medium uppercase tracking-[0.22em] text-indigo-600">Private knowledge workspace</p>
            <h1 className="serif-display max-w-md text-4xl leading-[1.02] text-[#172342] sm:text-5xl">Documents become answers you can trust.</h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-slate-600">Securely upload your reference material, ask in plain language, and review the exact passages behind every answer.</p>
            <Button onClick={() => startLogin()} size="lg" className="pressable mt-9 h-12 rounded-xl bg-[#202d59] px-6 text-sm font-bold hover:bg-[#2c3d74]">Sign in with Manus</Button>
            <p className="mt-5 text-xs text-slate-500">Your workspace is available only after secure Manus authentication.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-[#e5e9f2] bg-white/75 backdrop-blur-xl">
        <SidebarHeader className="h-[76px] justify-center px-4">
          <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#202d59] text-white shadow-md shadow-indigo-950/15"><BookOpenText className="size-[18px]" /></div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-extrabold tracking-[-0.04em] text-[#202d59]">DocuMind</p>
              <p className="mono mt-0.5 text-[9px] uppercase tracking-[0.13em] text-slate-400">Knowledge base</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-3">
          <SidebarMenu>
            {menuItems.map(item => <NavigationItem key={item.path} {...item} />)}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="rounded-2xl border border-[#e8ebf3] bg-white/80 p-2.5 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
              <Avatar className="size-8 border border-indigo-100"><AvatarFallback className="bg-indigo-50 text-xs font-bold text-indigo-700">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-bold text-[#24314f]">{user.name || "Workspace member"}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">Secure Manus session</p>
              </div>
              <button onClick={logout} className="pressable rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 group-data-[collapsible=icon]:hidden" aria-label="Sign out"><LogOut className="size-3.5" /></button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="canvas-glow min-h-svh">
        <header className="flex h-[70px] items-center border-b border-white/70 bg-white/45 px-4 backdrop-blur-xl sm:px-8">
          <SidebarTrigger className="mr-3 rounded-lg text-slate-500 hover:bg-white hover:text-[#202d59]" />
          <p className="mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Your private document workspace</p>
        </header>
        <main className="min-h-[calc(100svh-70px)] p-4 sm:p-7 lg:p-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function NavigationItem({ icon: Icon, label, path }: (typeof menuItems)[number]) {
  const [location, setLocation] = useLocation();
  const active = location === path || (location === "/" && path === "/documents");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setLocation(path)} isActive={active} tooltip={label} className="h-11 rounded-xl px-3 text-[13px] font-semibold text-slate-500 transition-all hover:bg-indigo-50 hover:text-[#344b92] data-[active=true]:bg-[#e8edff] data-[active=true]:text-[#263c85] data-[active=true]:shadow-sm">
        <Icon className="size-[17px]" /><span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
