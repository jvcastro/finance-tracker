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
import { defaultDueDayFromStatementDay } from "@/lib/credit-card-due-day";
import { isProtectedTagName } from "@/lib/default-tags";
import { DEFAULT_CURRENCY, formatCurrency, getCurrencySymbol } from "@/lib/format";
import {
  FINANCIAL_ACCOUNT_KIND_LABEL,
  FINANCIAL_ACCOUNT_KIND_VALUES,
  financialAccountKindSchema,
  type FinancialAccountKindValue,
} from "@/lib/financial-account-kind";
import { trpc } from "@/lib/trpc/react";

const settingsSchema = z.object({
  currency: z.string().min(1).max(8),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
});

type SettingsForm = z.infer<typeof settingsSchema>;

const tagSchema = z
  .object({
    name: z.string().min(1).max(64),
    color: z.string().max(32).optional(),
  })
  .superRefine((data, ctx) => {
    if (isProtectedTagName(data.name)) {
      ctx.addIssue({
        code: "custom",
        message: "That name is reserved for the built-in Credit card tag.",
        path: ["name"],
      });
    }
  });

const financialAccountSchema = z
  .object({
    name: z.string().min(1).max(120),
    kind: financialAccountKindSchema,
    notes: z.string().max(500).optional(),
    creditStatementDay: z.string().optional(),
    creditDueDay: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const check = (
      raw: string | undefined,
      path: "creditStatementDay" | "creditDueDay",
    ) => {
      if (!raw?.trim()) return;
      const n = Number.parseInt(raw.trim(), 10);
      if (Number.isNaN(n) || n < 1 || n > 31) {
        ctx.addIssue({
          code: "custom",
          message: "Use a calendar day from 1 to 31.",
          path: [path],
        });
      }
    };
    if (data.kind === "CREDIT_CARD") {
      check(data.creditStatementDay, "creditStatementDay");
      check(data.creditDueDay, "creditDueDay");
    }
  });

function parseCreditDay(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(n) || n < 1 || n > 31) return null;
  return n;
}

export function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading: settingsLoading } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: tags = [] } = trpc.tag.list.useQuery();
  const createTag = trpc.tag.create.useMutation({
    onSuccess: () => {
      void utils.tag.list.invalidate();
      toast.success("Tag created.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTag = trpc.tag.delete.useMutation({
    onSuccess: () => {
      void utils.tag.list.invalidate();
      toast.success("Tag deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { currency: DEFAULT_CURRENCY, weekStartsOn: 0 },
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
          Accounts, tags, and display preferences.
        </p>
      </div>

      <AccountsSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">App preferences</CardTitle>
          <CardDescription>Currency and first day of the week.</CardDescription>
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
                <Label htmlFor="currency">Currency (ISO 4217)</Label>
                <Input id="currency" {...form.register("currency")} placeholder="PHP" />
                <p className="text-muted-foreground text-xs">
                  Shown as{" "}
                  <span className="font-medium text-foreground">
                    {getCurrencySymbol(form.watch("currency") || DEFAULT_CURRENCY)}
                  </span>{" "}
                  · sample{" "}
                  {formatCurrency(
                    1234.56,
                    form.watch("currency") || DEFAULT_CURRENCY,
                  )}
                </p>
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
                <Button type="submit" disabled={updateSettings.isPending}>
                  Save preferences
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card data-tour="settings-tags">
        <CardHeader>
          <CardTitle className="text-base">Tags</CardTitle>
          <CardDescription>
            Use tags on income and expenses. Deleting a tag removes it from entries. The
            Credit card tag is built in and cannot be edited or removed.
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
              <Label htmlFor="tag-color">Color (hex, optional)</Label>
              <Input id="tag-color" placeholder="#888" {...tagForm.register("color")} />
            </div>
            <Button type="submit" disabled={createTag.isPending}>
              <IconPlus className="size-4" />
              Add
            </Button>
          </form>

          <Separator />

          <ul className="space-y-2">
            {tags.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tags yet.</p>
            ) : (
              tags.map((t) => {
                const locked = isProtectedTagName(t.name);
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {t.color ? (
                        <span
                          className="size-3 shrink-0 rounded-full border"
                          style={{ backgroundColor: t.color }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate">{t.name}</span>
                      {locked ? (
                        <span className="text-muted-foreground shrink-0 text-[0.625rem] font-medium uppercase tracking-wide">
                          Built-in
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={locked}
                      title={
                        locked
                          ? "Built-in tag: cannot delete"
                          : `Delete ${t.name}`
                      }
                      aria-label={locked ? `${t.name} (built-in, cannot delete)` : `Delete ${t.name}`}
                      onClick={() => {
                        if (!locked) deleteTag.mutate({ id: t.id });
                      }}
                    >
                      <IconTrash
                        className={`size-4 ${locked ? "text-muted-foreground opacity-40" : "text-destructive"}`}
                      />
                    </Button>
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsSection() {
  const utils = trpc.useUtils();
  const { data: accounts = [] } = trpc.financialAccount.list.useQuery();
  const createAccount = trpc.financialAccount.create.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      toast.success("Account added.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateAccount = trpc.financialAccount.update.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      toast.success("Account updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteAccount = trpc.financialAccount.delete.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      toast.success("Account deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const addForm = useForm<z.infer<typeof financialAccountSchema>>({
    resolver: zodResolver(financialAccountSchema),
    defaultValues: {
      name: "",
      kind: "CHECKING",
      notes: "",
      creditStatementDay: "",
      creditDueDay: "",
    },
  });

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const editForm = useForm<z.infer<typeof financialAccountSchema>>({
    resolver: zodResolver(financialAccountSchema),
    defaultValues: {
      name: "",
      kind: "CHECKING",
      notes: "",
      creditStatementDay: "",
      creditDueDay: "",
    },
  });

  React.useEffect(() => {
    if (!editOpen || !editingId) return;
    const a = accounts.find((x) => x.id === editingId);
    if (a) {
      editForm.reset({
        name: a.name,
        kind: a.kind as FinancialAccountKindValue,
        notes: a.notes ?? "",
        creditStatementDay:
          a.creditStatementDay != null ? String(a.creditStatementDay) : "",
        creditDueDay: a.creditDueDay != null ? String(a.creditDueDay) : "",
      });
    }
  }, [editOpen, editingId, accounts, editForm]);

  function onAddSubmit(values: z.infer<typeof financialAccountSchema>) {
    createAccount.mutate({
      name: values.name,
      kind: values.kind,
      notes: values.notes || undefined,
      creditStatementDay:
        values.kind === "CREDIT_CARD" ? parseCreditDay(values.creditStatementDay) : null,
      creditDueDay:
        values.kind === "CREDIT_CARD" ? parseCreditDay(values.creditDueDay) : null,
    });
    addForm.reset({
      name: "",
      kind: "CHECKING",
      notes: "",
      creditStatementDay: "",
      creditDueDay: "",
    });
  }

  function onEditSubmit(values: z.infer<typeof financialAccountSchema>) {
    if (!editingId) return;
    updateAccount.mutate({
      id: editingId,
      name: values.name,
      kind: values.kind,
      notes: values.notes || null,
      creditStatementDay:
        values.kind === "CREDIT_CARD" ? parseCreditDay(values.creditStatementDay) : null,
      creditDueDay:
        values.kind === "CREDIT_CARD" ? parseCreditDay(values.creditDueDay) : null,
    });
    setEditOpen(false);
    setEditingId(null);
  }

  return (
    <Card data-tour="settings-accounts">
      <CardHeader>
        <CardTitle className="text-base">Accounts</CardTitle>
        <CardDescription>
          Savings, checking, credit cards, e-wallets (e.g. GCash, Maya), or cash. Link them on
          income and expenses to see where money moves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={addForm.handleSubmit(onAddSubmit)}>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="fa-name">Name</Label>
            <Input
              id="fa-name"
              placeholder="e.g. BPI Savings, GCash, Maya"
              {...addForm.register("name")}
            />
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label>Type</Label>
            <Select
              value={addForm.watch("kind")}
              onValueChange={(v) => {
                const nv = v as FinancialAccountKindValue;
                if (nv !== "CREDIT_CARD") {
                  addForm.setValue("creditStatementDay", "");
                  addForm.setValue("creditDueDay", "");
                }
                addForm.setValue("kind", nv);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_ACCOUNT_KIND_VALUES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FINANCIAL_ACCOUNT_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-1">
            <Label htmlFor="fa-notes">Notes (optional)</Label>
            <Input
              id="fa-notes"
              placeholder="Joint, payroll in…"
              {...addForm.register("notes")}
            />
          </div>
          <div className="flex items-end sm:col-span-1">
            <Button type="submit" disabled={createAccount.isPending}>
              <IconPlus className="size-4" />
              Add
            </Button>
          </div>
          </div>

        {addForm.watch("kind") === "CREDIT_CARD" ? (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-muted-foreground text-xs">
              Billing cycle (day of each month). Payment due day defaults to about 20 days after
              the statement day; you can change it.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fa-stmt-day">Statement day</Label>
                <Input
                  id="fa-stmt-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="e.g. 15"
                  value={addForm.watch("creditStatementDay") ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    addForm.setValue("creditStatementDay", v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    if (v.trim() !== "") {
                      const n = Number.parseInt(v, 10);
                      if (!Number.isNaN(n) && n >= 1 && n <= 31) {
                        addForm.setValue(
                          "creditDueDay",
                          String(defaultDueDayFromStatementDay(n)),
                          { shouldDirty: true, shouldValidate: true },
                        );
                      }
                    }
                  }}
                />
                {addForm.formState.errors.creditStatementDay?.message ? (
                  <p className="text-destructive text-xs">
                    {addForm.formState.errors.creditStatementDay.message}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fa-due-day">Payment due day</Label>
                <Input
                  id="fa-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="e.g. 5"
                  value={addForm.watch("creditDueDay") ?? ""}
                  onChange={(e) =>
                    addForm.setValue("creditDueDay", e.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {addForm.formState.errors.creditDueDay?.message ? (
                  <p className="text-destructive text-xs">
                    {addForm.formState.errors.creditDueDay.message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        </form>

        <Separator />

        <ul className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No accounts yet.</p>
          ) : (
            accounts.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({FINANCIAL_ACCOUNT_KIND_LABEL[a.kind as FinancialAccountKindValue]})
                    </span>
                  </p>
                  {a.kind === "CREDIT_CARD" &&
                  (a.creditStatementDay != null || a.creditDueDay != null) ? (
                    <p className="text-muted-foreground text-xs">
                      {[
                        a.creditStatementDay != null
                          ? `Statement day ${a.creditStatementDay}`
                          : null,
                        a.creditDueDay != null ? `Due day ${a.creditDueDay}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {a.notes ? (
                    <p className="text-muted-foreground truncate text-xs">{a.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit ${a.name}`}
                    onClick={() => {
                      setEditingId(a.id);
                      setEditOpen(true);
                    }}
                  >
                    <IconPencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${a.name}`}
                    onClick={() => deleteAccount.mutate({ id: a.id })}
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
              <DialogTitle>Edit account</DialogTitle>
            </DialogHeader>
            <form className="grid gap-3" onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="edit-fa-name">Name</Label>
                <Input id="edit-fa-name" {...editForm.register("name")} />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={editForm.watch("kind")}
                  onValueChange={(v) => {
                    const nv = v as FinancialAccountKindValue;
                    if (nv !== "CREDIT_CARD") {
                      editForm.setValue("creditStatementDay", "");
                      editForm.setValue("creditDueDay", "");
                    }
                    editForm.setValue("kind", nv);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCIAL_ACCOUNT_KIND_VALUES.map((k) => (
                      <SelectItem key={k} value={k}>
                        {FINANCIAL_ACCOUNT_KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-fa-notes">Notes</Label>
                <Textarea id="edit-fa-notes" rows={3} {...editForm.register("notes")} />
              </div>
              {editForm.watch("kind") === "CREDIT_CARD" ? (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-muted-foreground text-xs">
                    Billing cycle (day of each month). Payment due day defaults to about 20 days
                    after the statement day; you can change it.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fa-stmt-day">Statement day</Label>
                      <Input
                        id="edit-fa-stmt-day"
                        type="number"
                        min={1}
                        max={31}
                        placeholder="e.g. 15"
                        value={editForm.watch("creditStatementDay") ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          editForm.setValue("creditStatementDay", v, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          if (v.trim() !== "") {
                            const n = Number.parseInt(v, 10);
                            if (!Number.isNaN(n) && n >= 1 && n <= 31) {
                              editForm.setValue(
                                "creditDueDay",
                                String(defaultDueDayFromStatementDay(n)),
                                { shouldDirty: true, shouldValidate: true },
                              );
                            }
                          }
                        }}
                      />
                      {editForm.formState.errors.creditStatementDay?.message ? (
                        <p className="text-destructive text-xs">
                          {editForm.formState.errors.creditStatementDay.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fa-due-day">Payment due day</Label>
                      <Input
                        id="edit-fa-due-day"
                        type="number"
                        min={1}
                        max={31}
                        placeholder="e.g. 5"
                        value={editForm.watch("creditDueDay") ?? ""}
                        onChange={(e) =>
                          editForm.setValue("creditDueDay", e.target.value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                      {editForm.formState.errors.creditDueDay?.message ? (
                        <p className="text-destructive text-xs">
                          {editForm.formState.errors.creditDueDay.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={updateAccount.isPending}>
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
