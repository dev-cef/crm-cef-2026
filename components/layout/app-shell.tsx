"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cake,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  UserCircle,
  Users,
  Wallet,
  Building2,
  KeyRound,
  ClipboardList,
  HardDriveDownload,
} from "lucide-react";
import { CefLogo } from "@/components/layout/cef-logo";
import { SessionBadge } from "@/components/layout/session-badge";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import {
  NAV_ITEMS,
  CONFIG_NAV_ITEMS,
  isRouteAllowed,
  normalizeRole,
  type Role,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logoutAction } from "@/app/(app)/actions";

const ICONS: Record<string, typeof Users> = {
  "/dashboard": LayoutDashboard,
  "/meu-espaco": UserCircle,
  "/associados": Users,
  "/carteirinha": CreditCard,
  "/aniversariantes": Cake,
  "/financeiro": Wallet,
  "/eventos": CalendarDays,
};

const CONFIG_ICONS: Record<string, typeof Users> = {
  "/configuracoes/seguranca":     Users,
  "/configuracoes/departamentos": Building2,
  "/configuracoes/aprovacoes":    UserCheck,
  "/configuracoes/auditoria":     ScrollText,
  "/configuracoes/backup":        HardDriveDownload,
};

function ConfigNavGroup({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isInConfig = pathname.startsWith("/configuracoes");

  return (
    <div className="px-3 pb-2">
      <p className="mb-1 flex items-center gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
        <Settings className="size-3" /> Configurações
      </p>
      {CONFIG_NAV_ITEMS.map(({ href, label }) => {
        const Icon = CONFIG_ICONS[href] ?? Settings;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-primary/8 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function NavLinks({
  role,
  onNavigate,
  hiddenModules = [],
}: {
  role: Role;
  onNavigate?: () => void;
  hiddenModules?: string[];
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) =>
      (!item.visibleTo || item.visibleTo.includes(role)) &&
      (!item.moduleSlug || !hiddenModules.includes(item.moduleSlug)),
  );

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ href, label, children }) => {
        const Icon = ICONS[href] ?? CreditCard;
        const allowed = isRouteAllowed(href, role);
        const active =
          allowed && (pathname === href || pathname.startsWith(`${href}/`));

        if (!allowed) {
          return (
            <span
              key={href}
              title="Acesso restrito — solicite ao Administrador"
              aria-disabled="true"
              className="group relative flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/35"
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              <Lock className="size-3.5" />
            </span>
          );
        }

        return (
          <div key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-primary/8 hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-4 transition-transform",
                  !active && "group-hover:scale-110",
                )}
              />
              {label}
            </Link>
            {children && active && (
              <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                {children.map((child) => {
                  const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={childActive ? "page" : undefined}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                        childActive
                          ? "text-primary"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {role === "ADMIN" && (
        <>
          <div className="my-2 h-px bg-sidebar-border" />
          <ConfigNavGroup onNavigate={onNavigate} />
        </>
      )}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
      <CefLogo className="size-10" />
      <div className="leading-tight">
        <p className="font-display text-[15px] tracking-[0.05em]">
          CRM CEF
        </p>
        <p className="text-[6px] uppercase tracking-[0.2em] text-muted-foreground">
          PAINEL DE CONTROLE
        </p>
      </div>
    </div>
  );
}

function SidebarFooter({
  name,
  email,
  initials,
}: {
  name?: string | null;
  email?: string | null;
  initials: string;
}) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{name ?? email}</p>
          {name && email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </div>
      </div>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          className="mt-1 w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </form>
    </div>
  );
}

export function AppShell({
  user,
  children,
  hiddenModules = [],
}: {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    expiresAt?: number;
    totpEnabled?: boolean;
  };
  hiddenModules?: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const role = normalizeRole(user.role);
  const isAdminUser = role === "ADMIN";
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-gradient-to-b from-sidebar to-background md:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavLinks role={role} hiddenModules={hiddenModules} />
        </div>
        <SidebarFooter
          name={user.name}
          email={user.email}
          initials={initials}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Abrir menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="flex h-full flex-col">
                <Brand />
                <div className="flex-1 overflow-y-auto">
                  <NavLinks role={role} onNavigate={() => setOpen(false)} hiddenModules={hiddenModules} />
                </div>
                <SidebarFooter
                  name={user.name}
                  email={user.email}
                  initials={initials}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2">
            {user.expiresAt ? (
              <SessionBadge expiresAt={user.expiresAt} />
            ) : null}
            <AnimatedThemeToggler
              aria-label="Alternar tema"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-2"
                  />
                }
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">
                  {user.name ?? user.email}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdminUser && (
                  <>
                    <DropdownMenuItem
                      render={
                        <Link href="/configuracoes/seguranca" className="w-full" />
                      }
                    >
                      {user.totpEnabled ? (
                        <ShieldCheck className="size-4 text-primary" />
                      ) : (
                        <ShieldAlert className="size-4 text-amber-500" />
                      )}
                      Segurança · 2FA{" "}
                      {user.totpEnabled ? "ativo" : "inativo"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <Link
                          href="/configuracoes/auditoria"
                          className="w-full"
                        />
                      }
                    >
                      <ScrollText className="size-4" />
                      Auditoria
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <Link
                          href="/configuracoes/aprovacoes"
                          className="w-full"
                        />
                      }
                    >
                      <UserCheck className="size-4" />
                      Aprovações
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <Link
                          href="/configuracoes/departamentos"
                          className="w-full"
                        />
                      }
                    >
                      <Building2 className="size-4" />
                      Departamentos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => logoutAction()}
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
