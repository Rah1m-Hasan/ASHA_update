import { modules, modulesIntro } from "@/content/landing";
import { ModuleIcon } from "./ModuleIcon";

/**
 * A drawing of the app home: the eight modules as they appear when someone
 * opens Asha and chooses what they want to use.
 */
export function ModuleRail() {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-panel">
        <div className="flex items-center justify-between gap-4 border-b border-line bg-wash px-5 py-4 sm:px-7">
          <span className="text-[11px] font-semibold tracking-[0.16em] text-accent-deep uppercase">
            {modulesIntro.rail.title}
          </span>
          <span className="hidden text-[13px] text-body sm:block">{modulesIntro.rail.hint}</span>
        </div>

        <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {modules.map((m) => (
            <li key={m.key} className="flex flex-col gap-3 bg-surface px-4 py-5 sm:px-5 sm:py-6">
              <span className="grid size-9 place-items-center rounded-[12px] bg-brand-soft text-brand">
                <ModuleIcon module={m.key} size={18} />
              </span>
              <span className="text-[15px] font-medium text-ink">{m.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-4 text-center text-[13px] text-body sm:hidden">{modulesIntro.rail.hint}</figcaption>
    </figure>
  );
}
