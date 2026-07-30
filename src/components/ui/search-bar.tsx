"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The standard search box.
 *
 * Every screen had grown its own input — different heights, some with a
 * magnifier and some without, none with a clear button — so a search box looked
 * like a different control on every page. This is the one shape: rounded, a
 * leading magnifier, a clear (✕) button once there is text, consistent height
 * and focus ring. Use it for every search field, in a form (`name`) or
 * controlled (`value` + `onValueChange`).
 */
export interface SearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "size"> {
  /** Controlled text. Omit to let it behave as a plain (form) input. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Called when the ✕ is pressed, after the value is cleared. */
  onClear?: () => void;
  /** md = navbar/inline (h-10), lg = page header (h-11). */
  size?: "md" | "lg";
  className?: string;
  containerClassName?: string;
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      value,
      onValueChange,
      onClear,
      size = "md",
      className,
      containerClassName,
      defaultValue,
      ...rest
    },
    forwardedRef,
  ) {
    // Uncontrolled use still needs the ✕ to work, so track the text either way
    // and keep our own ref for clearing the DOM node.
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const [internal, setInternal] = React.useState(
      typeof defaultValue === "string" ? defaultValue : "",
    );
    const controlled = value !== undefined;
    const text = controlled ? value : internal;

    function setRefs(node: HTMLInputElement | null) {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }

    function clear() {
      if (!controlled) {
        setInternal("");
        if (innerRef.current) innerRef.current.value = "";
      }
      onValueChange?.("");
      onClear?.();
      innerRef.current?.focus();
    }

    return (
      <div className={cn("relative", containerClassName)}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={setRefs}
          type="search"
          value={controlled ? value : undefined}
          defaultValue={controlled ? undefined : defaultValue}
          onChange={(e) => {
            if (!controlled) setInternal(e.target.value);
            onValueChange?.(e.target.value);
          }}
          className={cn(
            "w-full rounded-full border border-input bg-muted pl-9 text-sm outline-none transition-colors",
            "focus:bg-background focus:ring-1 focus:ring-ring",
            // Native search inputs draw their own clear button in WebKit; ours
            // is styled and keyboard-reachable, so hide theirs.
            "[&::-webkit-search-cancel-button]:appearance-none",
            size === "lg" ? "h-11" : "h-10",
            text ? "pr-9" : "pr-4",
            className,
          )}
          {...rest}
        />
        {text ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    );
  },
);
