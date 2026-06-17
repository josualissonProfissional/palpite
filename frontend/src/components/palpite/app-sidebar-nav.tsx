"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  ChartNoAxesColumnIncreasingIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  SettingsIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function AppSidebarNav({
  groupSlug,
  groupName = "Bolao",
}: {
  groupSlug?: string;
  groupName?: string;
}) {
  const pathname = usePathname() ?? "";
  const groupBase = groupSlug ? `/app/grupos/${groupSlug}` : "/app/grupos";

  const groupItems = groupSlug
    ? [
        { label: "Resumo", href: groupBase, icon: TrophyIcon },
        { label: "Jogos e palpites", href: `${groupBase}/jogos`, icon: CalendarDaysIcon },
        { label: "Ranking", href: `${groupBase}/ranking`, icon: ChartNoAxesColumnIncreasingIcon },
        { label: "Membros", href: `${groupBase}/membros`, icon: UsersIcon },
        { label: "Regras", href: `${groupBase}/regras`, icon: SettingsIcon },
      ]
    : [];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {groupSlug ? (
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={groupName}>
                      <TrophyIcon className="size-4" />
                      <span className="truncate">{groupName}</span>
                      <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {groupItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href}>
                              <item.icon className="size-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}

      <SidebarGroup className="py-1">
        <SidebarGroupLabel>Copa do Mundo</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Classificacao" isActive={isActive("/app/copa")}>
                <Link href="/app/copa">
                  <ClipboardListIcon className="size-4" />
                  <span>Classificacao</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="py-1">
        <SidebarGroupLabel>Conta</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Meus grupos" isActive={isActive("/app/grupos") || isActive("/app")}>
                <Link href="/app/grupos">
                  <UsersIcon className="size-4" />
                  <span>Meus grupos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Perfil" isActive={pathname.startsWith("/app/perfil")}>
                <Link href="/app/perfil">
                  <UserIcon className="size-4" />
                  <span>Perfil</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
