"use client";

import * as React from "react";
import { zodResolver } from "@/lib/zod-resolver";
import { TRPCClientError } from "@trpc/client";
import { IconBrandGoogle } from "@tabler/icons-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/react";

const schema = z
  .object({
    name: z.string().max(120).optional(),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const register = trpc.auth.register.useMutation();
  const [pending, setPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      await register.mutateAsync({
        email: values.email,
        password: values.password,
        name: values.name || undefined,
      });
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: "/",
      });
      if (res?.error) {
        toast.success("Account created. Please sign in.");
        return;
      }
      if (res?.url) {
        window.location.href = res.url;
      } else {
        window.location.href = "/";
      }
    } catch (e) {
      const msg =
        e instanceof TRPCClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not create account";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-base">Create account</CardTitle>
        <CardDescription>Email/password or Google.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleEnabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => {
                void signIn("google", { callbackUrl: "/" });
              }}
            >
              <IconBrandGoogle className="size-4" />
              Continue with Google
            </Button>
            <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
              <div className="bg-border h-px flex-1" />
              or
              <div className="bg-border h-px flex-1" />
            </div>
          </>
        ) : null}

        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" autoComplete="name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...form.register("confirm")}
            />
            {form.formState.errors.confirm ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.confirm.message}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-xs">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
