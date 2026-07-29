import type { RailwayFilterOption } from "../types/railway.ts";

export const VISIBLE_LINES_STORAGE_KEY =
  "train-live-map-keikyu:visible-lines";
export const SELECTION_DEFAULT_VERSION_KEY =
  "train-live-map-keikyu:visible-lines-default-version";
export const SELECTION_DEFAULT_VERSION = "1";
export const FAVORITE_LINES_STORAGE_KEY =
  "train-live-map-keikyu:favorite-lines";

/**
 * localStorageの値から、現在も存在する路線IDだけを復元する。
 * JSON破損や想定外の型はnullとして扱い、呼び出し側で安全な既定値へ戻す。
 */
export function parseStoredRailwayIds(
  stored: string | null,
  knownIds: ReadonlySet<string>,
): Set<string> | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(
      parsed.filter(
        (id): id is string =>
          typeof id === "string" && knownIds.has(id),
      ),
    );
  } catch {
    return null;
  }
}

export function restoreVisibleRailwayIds({
  stored,
  storedDefaultVersion,
  availableIds,
  defaultIds,
}: {
  stored: string | null;
  storedDefaultVersion: string | null;
  availableIds: ReadonlySet<string>;
  defaultIds: ReadonlySet<string>;
}): Set<string> {
  const restored = parseStoredRailwayIds(stored, availableIds);
  return restored !== null &&
    storedDefaultVersion === SELECTION_DEFAULT_VERSION
    ? restored
    : new Set(defaultIds);
}

export function toggleRailwayId(
  current: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function filterRailwayOptions(
  options: readonly RailwayFilterOption[],
  query: string,
  favoritesOnly: boolean,
  favoriteIds: ReadonlySet<string>,
): RailwayFilterOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  return options.filter((option) => {
    if (favoritesOnly && !favoriteIds.has(option.id)) return false;
    if (!normalizedQuery) return true;
    return [option.name, option.category, ...option.aliases].some((value) =>
      value.toLocaleLowerCase("ja").includes(normalizedQuery),
    );
  });
}
