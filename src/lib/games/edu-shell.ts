// Shared shell + type for the built-in educational games. Kept in its own
// module so both edu-games.ts and edu-games-extra.ts can import it without a
// circular dependency.

export interface EduGame {
  slug: string;
  emoji: string;
  /** i18n keys in the "games" namespace (older games). */
  titleKey?: string;
  descKey?: string;
  /** Inline title/description (Burmese-primary) — preferred when present. */
  title?: string;
  desc?: string;
  html: string;
}

export const SHELL = `<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:1.1rem;text-align:center;background:#EAF3DE;color:#173404}
  h2{margin:.2rem 0}
  button{font-size:1rem;padding:.5rem 1rem;border:0;border-radius:10px;background:#639922;color:#fff;cursor:pointer;margin:.15rem}
  button:active{transform:scale(.97)}
  .bar{font-weight:bold;margin:.4rem 0}
  .grid{display:grid;gap:8px;max-width:340px;margin:1rem auto}
  .opt{font-size:1.1rem;padding:.6rem;background:#fff;color:#173404;border:2px solid #639922;border-radius:10px;cursor:pointer}
  .ok{background:#bbf7d0!important}.no{background:#fecaca!important}
</style>`;
