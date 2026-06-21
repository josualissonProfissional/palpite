"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartNoAxesColumnIncreasingIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  ShirtIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { CreateGroupForm } from "@/components/palpite/group-actions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/client";

type GroupLink = { id: string; name: string; slug: string };

export function AppSidebarNav({
  groupSlug,
  groupName = "Bolao",
}: {
  groupSlug?: string;
  groupName?: string;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [groups, setGroups] = useState<GroupLink[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setIsAdmin(isAdminEmail(user.email));
      const { data } = await supabase
        .schema("palpite")
        .from("group_members")
        .select("group:group_id(id,name,slug)")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (!active || !data) return;
      const list = (data as unknown as { group: GroupLink | null }[])
        .map((row) => row.group)
        .filter((g): g is GroupLink => Boolean(g));
      setGroups(list);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/entrar");
    router.refresh();
  }

  const groupBase = groupSlug ? `/app/grupos/${groupSlug}` : "/app/grupos";
  const groupItems = groupSlug
    ? [
        { label: "Resumo e jogos", href: groupBase, icon: TrophyIcon },
        { label: "Ranking", href: `${groupBase}/ranking`, icon: ChartNoAxesColumnIncreasingIcon },
        { label: "Times", href: `${groupBase}/times`, icon: ShirtIcon },
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
        <SidebarGroupLabel>Meus grupos</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {groups.map((group) => (
              <SidebarMenuItem key={group.id}>
                <SidebarMenuButton
                  asChild
                  tooltip={group.name}
                  isActive={pathname.startsWith(`/app/grupos/${group.slug}`)}
                >
                  <Link href={`/app/grupos/${group.slug}`}>
                    <TrophyIcon className="size-4" />
                    <span className="truncate">{group.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Ver todos os grupos"
                isActive={isActive("/app/grupos") || isActive("/app")}
              >
                <Link href="/app/grupos">
                  <UsersIcon className="size-4" />
                  <span>{groups.length > 0 ? "Todos os grupos" : "Entrar em grupo"}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Dialog>
                <DialogTrigger asChild>
                  <SidebarMenuButton tooltip="Criar grupo">
                    <PlusIcon className="size-4" />
                    <span>Criar grupo</span>
                  </SidebarMenuButton>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar bolao</DialogTitle>
                    <DialogDescription>
                      Informe o nome e uma descricao. O link do grupo sera criado automaticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateGroupForm />
                </DialogContent>
              </Dialog>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

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
            {isAdmin ? (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Admin" isActive={pathname.startsWith("/app/admin")}>
                  <Link href="/app/admin">
                    <ShieldCheckIcon className="size-4" />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Perfil" isActive={pathname.startsWith("/app/perfil")}>
                <Link href="/app/perfil">
                  <UserIcon className="size-4" />
                  <span>Perfil</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sair" onClick={handleLogout}>
                <LogOutIcon className="size-4" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
