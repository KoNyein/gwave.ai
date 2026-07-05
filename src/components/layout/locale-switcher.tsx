"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { Globe } from "lucide-react";

import { setLocale } from "@/app/actions/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/i18n/config";

const LABELS: Record<Locale, string> = {
  en: "English",
  my: "မြန်မာ",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change language" disabled={isPending}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => startTransition(() => setLocale(l))}
            className={l === locale ? "font-semibold" : ""}
          >
            {LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
