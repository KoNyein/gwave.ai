"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "gw-color-mode";

/** Apply a colour mode by toggling the `dark` class on <html> (Tailwind
 *  darkMode: 'class'); "system" follows the OS preference. */
function apply(mode: Mode) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Light / Dark / System colour-mode switch. Stores the choice in localStorage
 * and toggles the `dark` class on <html>; the no-flash script in the layout
 * applies it before first paint. Site themes (data-theme) are unaffected —
 * dark just layers on top via the `.dark[data-theme=…]` rules.
 */
export function ThemeToggle() {
  const [mode, setMode] = React.useState<Mode>("system");

  React.useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
    setMode(saved);
    apply(saved);
    // Keep "system" in sync if the OS theme changes while the app is open.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Mode | null) === "system") {
        apply("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }

  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => choose("light")}
          className={mode === "light" ? "font-semibold" : ""}
        >
          <Sun className="mr-2 h-4 w-4" /> Light · အလင်း
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => choose("dark")}
          className={mode === "dark" ? "font-semibold" : ""}
        >
          <Moon className="mr-2 h-4 w-4" /> Dark · အမှောင်
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => choose("system")}
          className={mode === "system" ? "font-semibold" : ""}
        >
          <Monitor className="mr-2 h-4 w-4" /> System · စက်အလိုက်
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
