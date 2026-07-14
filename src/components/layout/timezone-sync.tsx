"use client";

import * as React from "react";

import { captureTimezone } from "@/app/actions/telemetry";

/**
 * Once per session, report the browser's timezone so admin demographics know
 * the user's region. Runs only for signed-in users; the server ignores it when
 * a timezone is already stored. Renders nothing.
 */
export function TimezoneSync() {
  React.useEffect(() => {
    try {
      if (sessionStorage.getItem("gw:tz-sent")) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        void captureTimezone(tz);
        sessionStorage.setItem("gw:tz-sent", "1");
      }
    } catch {
      /* private mode / no Intl — skip */
    }
  }, []);
  return null;
}
