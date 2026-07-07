import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OPENAPI_SPEC } from "@/lib/openapi";

export default async function ApiDocsPage() {
  const t = await getTranslations("dev");
  const paths = Object.entries(OPENAPI_SPEC.paths);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-bold">{t("docsTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {OPENAPI_SPEC.info.description}{" "}
          <a
            href="/api/v1/openapi.json"
            className="font-medium text-primary hover:underline"
          >
            openapi.json
          </a>
        </p>
      </div>

      {paths.map(([path, methods]) => {
        const operation = methods.get;
        const parameters = (operation.parameters ?? []) as unknown as {
          name: string;
          in: string;
          schema?: { type?: string; enum?: readonly string[] };
        }[];
        const queryExample = parameters
          .filter((parameter) => parameter.name !== "limit")
          .slice(0, 1)
          .map((parameter) =>
            parameter.schema?.enum
              ? `${parameter.name}=${parameter.schema.enum[0]}`
              : `${parameter.name}=blue`,
          )
          .join("&");

        return (
          <Card key={path}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-primary">
                  GET
                </span>
                <span className="font-mono">/api/v1{path}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                {operation.summary}
                {" — "}
                <span className="text-muted-foreground">
                  {operation.description}
                </span>
              </p>
              {parameters.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parameters.map((parameter) => (
                    <span
                      key={parameter.name}
                      className="rounded-full border px-2 py-0.5 font-mono text-xs"
                    >
                      ?{parameter.name}
                      {parameter.schema?.enum
                        ? `=${parameter.schema.enum.join("|")}`
                        : ""}
                    </span>
                  ))}
                </div>
              ) : null}
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                {`curl -H "Authorization: Bearer gw_xxxx_yyyy" \\\n  "https://social.gwave.cc/api/v1${path}${queryExample ? `?${queryExample}` : ""}"`}
              </pre>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
