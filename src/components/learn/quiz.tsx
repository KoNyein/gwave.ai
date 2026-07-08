"use client";

import * as React from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  reportLessonComplete,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import type { QuizQuestion } from "@/lib/learn/lessons";
import { cn } from "@/lib/utils";

export function Quiz({
  questions,
  lesson,
}: {
  questions: QuizQuestion[];
  /** When set, submitting records completion + score for this lesson. */
  lesson?: LessonRef;
}) {
  const [answers, setAnswers] = React.useState<(number | null)[]>(
    () => questions.map(() => null),
  );
  const [submitted, setSubmitted] = React.useState(false);

  const score = answers.reduce<number>(
    (acc, a, i) => acc + (a === questions[i]?.answer ? 1 : 0),
    0,
  );
  const allAnswered = answers.every((a) => a !== null);

  function choose(qi: number, oi: number) {
    if (submitted) return;
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
  }

  function reset() {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
  }

  function submit() {
    setSubmitted(true);
    // Optimistic: the result banner shows instantly; the server keeps the
    // best score, so retries can only improve it.
    reportLessonComplete(
      lesson,
      Math.round((score / questions.length) * 100),
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((question, qi) => (
        <Card key={qi}>
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">
              {qi + 1}. {question.q}
            </p>
            <div className="grid gap-2">
              {question.options.map((option, oi) => {
                const chosen = answers[qi] === oi;
                const correct = question.answer === oi;
                const showState = submitted && (chosen || correct);
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => choose(qi, oi)}
                    disabled={submitted}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      !submitted && chosen && "border-primary bg-primary/5",
                      !submitted && !chosen && "hover:bg-muted",
                      showState && correct && "border-green-600 bg-green-600/10",
                      showState &&
                        chosen &&
                        !correct &&
                        "border-destructive bg-destructive/10",
                    )}
                  >
                    <span>{option}</span>
                    {showState && correct && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {showState && chosen && !correct && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </button>
                );
              })}
            </div>
            {submitted && question.explain && (
              <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                {question.explain}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {submitted ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary p-4">
          <p className="font-semibold">
            You scored {score} / {questions.length}
            {score === questions.length ? " — perfect! 🎉" : ""}
          </p>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      ) : (
        <Button className="w-full" disabled={!allAnswered} onClick={submit}>
          {allAnswered ? "Check answers" : "Answer all questions to continue"}
        </Button>
      )}
    </div>
  );
}
