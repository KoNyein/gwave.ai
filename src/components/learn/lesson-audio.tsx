"use client";

import * as React from "react";
import { Pause, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

// Map the app locale to a speech-synthesis language tag so the browser
// picks a matching voice (Burmese for `my`, etc.).
const SPEECH_LANG: Record<string, string> = {
  my: "my-MM",
  en: "en-US",
  th: "th-TH",
  zh: "zh-CN",
};

/**
 * Reads a lesson aloud in the active language using the browser's built-in
 * text-to-speech (Web Speech API). For Myanmar learners with the site set to
 * Burmese this speaks the Burmese lesson text — an audio explanation that
 * needs no uploaded files. Hidden entirely when the browser has no speech
 * support.
 */
export function LessonAudio({
  text,
  locale,
}: {
  text: string;
  locale: string;
}) {
  const t = useTranslations("learn");
  const [supported, setSupported] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);

  React.useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
    // Always stop any narration when leaving the lesson.
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const base = lang.split("-")[0] ?? lang;
    return (
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(base))
    );
  }

  function toggle() {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const lang = SPEECH_LANG[locale] ?? "en-US";
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    const voice = pickVoice(lang);
    if (voice) utter.voice = voice;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utter);
    setSpeaking(true);
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      className="gap-1.5"
      aria-pressed={speaking}
    >
      {speaking ? (
        <>
          <Pause className="h-4 w-4" /> {t("stopAudio")}
        </>
      ) : (
        <>
          <Volume2 className="h-4 w-4" /> {t("listen")}
        </>
      )}
    </Button>
  );
}
