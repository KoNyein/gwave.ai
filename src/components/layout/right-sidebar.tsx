import { getTranslations } from "next-intl/server";

export async function RightSidebar() {
  const t = await getTranslations("rightbar");

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-80 shrink-0 overflow-y-auto px-3 py-4 xl:block">
      <section>
        <h2 className="px-2 pb-2 text-sm font-semibold text-muted-foreground">
          {t("suggestions")}
        </h2>
        <div className="space-y-1">
          {[
            "Hydro Growers MM",
            "Nutrient Lab",
            "VPD Masters",
            "Seed Exchange",
          ].map((name) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">
                {name.slice(0, 1)}
              </span>
              <span className="text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <hr className="my-4" />

      <section>
        <h2 className="px-2 pb-2 text-sm font-semibold text-muted-foreground">
          {t("contacts")}
        </h2>
        <div className="space-y-1">
          {["Aung", "Su Su", "Min Thu", "Nilar"].map((name) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
            >
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">
                {name.slice(0, 1)}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
              </span>
              <span className="text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
