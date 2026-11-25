"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, LayoutDashboard, LogOut, Menu, Scale, ShieldCheck, UserCircle2, Users } from "lucide-react";
import type { User } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu-slider";
import { de } from "@/i18n/de";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  exact?: boolean;
}

function navFor(user: User): NavItem[] {
  return user.role === "admin"
    ? [
        { href: "/admin", label: de.nav.projects, icon: FolderKanban },
        { href: "/admin/clients", label: de.nav.clients, icon: Users },
        { href: "/security", label: de.nav.security, icon: ShieldCheck },
      ]
    : [
        { href: "/client", label: de.nav.dashboard, icon: LayoutDashboard },
        { href: "/security", label: de.nav.security, icon: ShieldCheck },
      ];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/projects");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ user, onNavigate }: { user: User; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {navFor(user).map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent",
                active ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
        K
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">{de.app.name}</p>
        <p className="text-[11px] text-muted-foreground">{de.app.phaseBadge}</p>
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <nav aria-label={de.nav.legal} className="grid gap-1 px-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5 font-medium">
        <Scale className="size-3.5" aria-hidden="true" /> {de.legal.footer}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <Link href="/impressum" className="hover:text-foreground">{de.legal.impressum}</Link>
        <Link href="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
        <Link href="/agb" className="hover:text-foreground">AGB</Link>
      </div>
    </nav>
  );
}

export function AppShell({ user, onSignOut, children }: { user: User; onSignOut: () => void; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  return (
    <div className="flex min-h-dvh w-full">
      <a href="#main" className="sr-only z-50 rounded-xl bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {de.nav.skipToContent}
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r border-border bg-card/40 py-5 lg:flex" data-testid="sidebar">
        <div className="grid gap-6">
          <Brand />
          <nav aria-label={de.nav.main} className="px-2">
            <NavLinks user={user} />
          </nav>
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-8">
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={de.common.openMenu} data-testid="menu-button">
                <Menu aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <SheetContent title={de.nav.main} className="justify-between py-5">
              <div className="grid gap-6">
                <Brand />
                <nav aria-label={de.nav.main} className="px-2">
                  <NavLinks user={user} onNavigate={() => setDrawerOpen(false)} />
                </nav>
              </div>
              <SidebarFooter />
            </SheetContent>
          </Dialog>

          <div className="flex-1" />
          <Badge variant="neutral" className="hidden sm:inline-flex">
            {user.role === "admin" ? de.nav.roleAdmin : de.nav.roleClient}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2" aria-label={`${de.nav.userMenu} ${user.fullName}`} data-testid="user-menu">
                <UserCircle2 aria-hidden="true" className="size-5" />
                <span className="hidden max-w-40 truncate text-sm sm:inline">{user.fullName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <span className="block text-sm text-foreground">{user.fullName}</span>
                <span className="block truncate">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/security">
                  <ShieldCheck aria-hidden="true" />
                  {de.nav.security}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSignOut} data-testid="logout">
                <LogOut aria-hidden="true" />
                {de.nav.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
