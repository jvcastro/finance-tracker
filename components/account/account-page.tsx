"use client";

import * as React from "react";
import { zodResolver } from "@/lib/zod-resolver";
import { IconLogout } from "@tabler/icons-react";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/react";

const profileSchema = z.object({
  name: z.string().max(120).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function initials(name: string | null | undefined, email: string | null | undefined) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase() || "?";
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "FT";
}

export function AccountPage() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.me.useQuery();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      void utils.profile.me.invalidate();
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
  });

  React.useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name ?? "",
        email: profile.email ?? "",
      });
    }
  }, [profile, form]);

  function onSubmit(values: ProfileForm) {
    update.mutate({
      name: values.name?.trim() || null,
      email: values.email === "" ? null : values.email?.trim() || null,
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-sm">
          Your profile is tied to this login. Sign out when you&apos;re done on a shared device.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">
              {initials(profile?.name, profile?.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">
              {profile?.name?.trim() || "Your account"}
            </CardTitle>
            <CardDescription>
              {profile?.email?.trim() || "No email on file"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" {...form.register("name")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={update.isPending}>
                  Save profile
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void signOut({ callbackUrl: "/login" })}
                >
                  <IconLogout className="size-4" />
                  Sign out
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
