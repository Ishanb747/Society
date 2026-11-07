import { changeCategory } from "@/app/actions/complaints";
import { CATEGORIES, CATEGORY_LABEL, type CategoryKey } from "@/lib/constants";
import { Chip } from "./ui";

/** One-tap recategorise: pick a category and it's saved. No JavaScript needed. */
export function CategoryMenu({ id, current }: { id: string; current: string }) {
  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center" aria-label={`Category ${CATEGORY_LABEL[current as CategoryKey]}. Change`}>
        <Chip tone="accent">{CATEGORY_LABEL[current as CategoryKey]} ▾</Chip>
      </summary>
      <form action={changeCategory} className="absolute left-0 top-full z-30 mt-1 w-48 rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_rgba(9,10,10,0.12)]">
        <input type="hidden" name="id" value={id} />
        {CATEGORIES.map((c) => (
          <button key={c} name="category" value={c} className={`flex h-11 w-full items-center justify-between rounded-sm px-3 text-left text-[15px] hover:bg-surface-2 ${c === current ? "font-semibold" : ""}`}>
            {CATEGORY_LABEL[c]}{c === current && <span aria-hidden>✓</span>}
          </button>
        ))}
      </form>
    </details>
  );
}
