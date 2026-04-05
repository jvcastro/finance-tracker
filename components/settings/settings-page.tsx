"use client";

import * as React from "react";
import { zodResolver } from "@/lib/zod-resolver";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";

const settingsSchema = z.object({
  currency: z.string().min(1).max(8),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const tagSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().max(32).optional(),
});

const bankSchema = z.object({
  name: z.string().min(1).max(120),
  notes: z.string().max(500).optional(),
});

export function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading: settingsLoading } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: tags = [] } = trpc.tag.list.useQuery();
  const createTag = trpc.tag.create.useMutation({
    onSuccess: () => {
      void utils.tag.list.invalidate();
      toast.success("Tag created");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTag = trpc.tag.delete.useMutation({
    onSuccess: () => {
      void utils.tag.list.invalidate();
      toast.success("Tag removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { currency: "USD", weekStartsOn: 0 },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        currency: settings.currency,
        weekStartsOn: settings.weekStartsOn,
      });
    }
  }, [settings, form]);

  const tagForm = useForm<z.infer<typeof tagSchema>>({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: "", color: "" },
  });

  function onSettingsSubmit(values: SettingsForm) {
    updateSettings.mutate(values);
  }

  function onTagSubmit(values: z.infer<typeof tagSchema>) {
    createTag.mutate({
      name: values.name,
      color: values.color || undefined,
    });
    tagForm.reset({ name: "", color: "" });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Banks, tags, and display preferences for your workspace.
        </p>
      </div>

      <BanksSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">App preferences</CardTitle>
          <CardDescription>Currency code and how weeks align in reports.</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={form.handleSubmit(onSettingsSubmit)}
            >
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="currency">Currency (ISO code)</Label>
                <Input id="currency" {...form.register("currency")} placeholder="USD" />
              </div>
              <div className="grid gap-2 sm:col-span-1">
                <Label>Week starts on</Label>
                <Select
                  value={String(form.watch("weekStartsOn"))}
                  onValueChange={(v) => form.setValue("weekStartsOn", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" disabled={updateSettings.isPending}>
                  Save preferences
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tags</CardTitle>
          <CardDescription>
            Use tags on income and expense rows. Deleting a tag unsets it on existing rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={tagForm.handleSubmit(onTagSubmit)}
          >
            <div className="grid flex-1 gap-2">
              <Label htmlFor="tag-name">New tag</Label>
              <Input id="tag-name" placeholder="Groceries" {...tagForm.register("name")} />
            </div>
            <div className="grid w-full gap-2 sm:max-w-[140px]">
              <Label htmlFor="tag-color">Color (hex)</Label>
              <Input id="tag-color" placeholder="#888" {...tagForm.register("color")} />
            </div>
            <Button type="submit" size="sm" disabled={createTag.isPending}>
              <IconPlus className="size-4" />
              Add
            </Button>
          </form>

          <Separator />

          <ul className="space-y-2">
            {tags.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tags yet.</p>
            ) : (
              tags.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {t.color ? (
                      <span
                        className="size-3 rounded-full border"
                        style={{ backgroundColor: t.color }}
                        aria-hidden
                      />
                    ) : null}
                    {t.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => deleteTag.mutate({ id: t.id })}
                  >
                    <IconTrash className="size-4 text-destructive" />
                  </Button>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function BanksSection() {
  const utils = trpc.useUtils();
  const { data: banks = [] } = trpc.bank.list.useQuery();
  const createBank = trpc.bank.create.useMutation({
    onSuccess: () => {
      void utils.bank.list.invalidate();
      toast.success("Bank added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateBank = trpc.bank.update.useMutation({
    onSuccess: () => {
      void utils.bank.list.invalidate();
      toast.success("Bank updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteBank = trpc.bank.delete.useMutation({
    onSuccess: () => {
      void utils.bank.list.invalidate();
      toast.success("Bank removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const addForm = useForm<z.infer<typeof bankSchema>>({
    resolver: zodResolver(bankSchema),
    defaultValues: { name: "", notes: "" },
  });

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const editForm = useForm<z.infer<typeof bankSchema>>({
    resolver: zodResolver(bankSchema),
    defaultValues: { name: "", notes: "" },
  });

  React.useEffect(() => {
    if (!editOpen || !editingId) return;
    const b = banks.find((x) => x.id === editingId);
    if (b) {
      editForm.reset({ name: b.name, notes: b.notes ?? "" });
    }
  }, [editOpen, editingId, banks, editForm]);

  function onAddSubmit(values: z.infer<typeof bankSchema>) {
    createBank.mutate({
      name: values.name,
      notes: values.notes || undefined,
    });
    addForm.reset({ name: "", notes: "" });
  }

  function onEditSubmit(values: z.infer<typeof bankSchema>) {
    if (!editingId) return;
    updateBank.mutate({
      id: editingId,
      name: values.name,
      notes: values.notes || null,
    });
    setEditOpen(false);
    setEditingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Banks</CardTitle>
        <CardDescription>
          Keep a list of banks and institutions you use (e.g. checking, savings, card issuers). You
          can reference these when logging expenses or credit card entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={addForm.handleSubmit(onAddSubmit)}
        >
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="bank-name">Bank name</Label>
            <Input
              id="bank-name"
              placeholder="e.g. Chase, Ally Bank"
              {...addForm.register("name")}
            />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="bank-notes">Notes (optional)</Label>
            <Input
              id="bank-notes"
              placeholder="Main checking, joint account…"
              {...addForm.register("notes")}
            />
          </div>
          <div className="flex items-end sm:col-span-1">
            <Button type="submit" size="sm" disabled={createBank.isPending}>
              <IconPlus className="size-4" />
              Add bank
            </Button>
          </div>
        </form>

        <Separator />

        <ul className="space-y-2">
          {banks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No banks yet.</p>
          ) : (
            banks.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{b.name}</p>
                  {b.notes ? (
                    <p className="text-muted-foreground truncate text-xs">{b.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit ${b.name}`}
                    onClick={() => {
                      setEditingId(b.id);
                      setEditOpen(true);
                    }}
                  >
                    <IconPencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${b.name}`}
                    onClick={() => deleteBank.mutate({ id: b.id })}
                  >
                    <IconTrash className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditingId(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit bank</DialogTitle>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="edit-bank-name">Name</Label>
                <Input id="edit-bank-name" {...editForm.register("name")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bank-notes">Notes</Label>
                <Textarea id="edit-bank-notes" rows={3} {...editForm.register("notes")} />
              </div>
              <DialogFooter>
                <Button type="submit" size="sm" disabled={updateBank.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
