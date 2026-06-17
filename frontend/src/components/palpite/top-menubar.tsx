"use client";

import Link from "next/link";
import Image from "next/image";
import {
  CircleUserRoundIcon,
  LogInIcon,
  UsersRoundIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/palpite/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

export function TopMenubar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 px-4 py-3">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-xl border border-white/55 bg-white/58 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/62">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Image
            src="/logo/logo-apenas-desenho-sem-fundo.svg"
            alt="Palpitô"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg object-contain"
            priority
          />
          <span className="font-heading text-xl font-bold leading-none text-slate-950 dark:text-white">
            Palpitô
          </span>
        </Link>

        <Menubar className="hidden border-white/60 bg-white/55 backdrop-blur md:flex dark:border-white/10 dark:bg-slate-950/55">
          <MenubarMenu>
            <MenubarTrigger>Bolao</MenubarTrigger>
            <MenubarContent>
              <MenubarGroup>
                <MenubarItem asChild>
                  <Link href="/criar-conta">
                    Criar conta e grupo
                    <MenubarShortcut>
                      <UsersRoundIcon className="size-3.5" />
                    </MenubarShortcut>
                  </Link>
                </MenubarItem>
                <MenubarItem asChild>
                  <Link href="/entrar">
                    Fazer login
                    <MenubarShortcut>
                      <LogInIcon className="size-3.5" />
                    </MenubarShortcut>
                  </Link>
                </MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarItem asChild>
                  <Link href="/app">
                    Abrir app
                    <MenubarShortcut>
                      <CircleUserRoundIcon className="size-3.5" />
                    </MenubarShortcut>
                  </Link>
                </MenubarItem>
              </MenubarGroup>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/criar-conta">Criar conta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
