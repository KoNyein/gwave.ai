"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPage } from "@/lib/actions/pages";

export function CreatePageDialog() {
  const t = useTranslations("pages");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await createPage({ name, category, description });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push(`/pages/${result.data.slug}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("create")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="page-name">{t("name")}</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="page-category">{t("category")}</Label>
            <Input
              id="page-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={60}
              placeholder={t("categoryPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="page-description">{t("description")}</Label>
            <Textarea
              id="page-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || name.trim().length < 3}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
