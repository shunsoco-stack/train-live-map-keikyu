import type {
  RailwayCatalogLine,
  RailwayFilterOption,
} from "@/types/railway";

export type KeikyuLineId =
  | "main"
  | "airport"
  | "daishi"
  | "zushi"
  | "kurihama";

interface KeikyuCatalogDefinition extends RailwayCatalogLine {
  id: KeikyuLineId;
  /** ODPT 応答の title と照合する有限の完全一致候補。 */
  identityTitles: string[];
  /** stationOrder に両方必要な駅名候補。 */
  identityStations: [string[], string[]];
}

function line(
  id: KeikyuLineId,
  name: string,
  aliases: string[],
  identityTitles: string[],
  identityStations: [string[], string[]],
  coverageNote: string | null = null,
): KeikyuCatalogDefinition {
  return {
    id,
    name,
    category: "京急線",
    color: "#e60012",
    aliases,
    coverage: "realtime",
    coverageNote,
    kind: "line",
    identityTitles,
    identityStations,
  };
}

/**
 * アプリ内で扱う5路線。
 *
 * odpt.Railway:* の ID はここに固定しない。実際の odpt:Railway 応答に含まれる
 * title と stationOrder を下の identifyKeikyuRailway で照合して初めて結び付ける。
 */
const DEFINITIONS: KeikyuCatalogDefinition[] = [
  line(
    "main",
    "京急本線",
    ["本線", "京浜急行本線", "Main Line"],
    ["本線", "京急本線", "京浜急行本線", "Main", "Main Line"],
    [["品川"], ["浦賀"]],
    "品川〜泉岳寺間は列車位置情報の提供対象外",
  ),
  line(
    "airport",
    "空港線",
    ["京急空港線", "Airport Line"],
    ["空港線", "京急空港線", "Airport", "Airport Line"],
    [
      ["京急蒲田"],
      [
        "羽田空港第1・第2ターミナル",
        "羽田空港第1第2ターミナル",
        "羽田空港国内線ターミナル",
      ],
    ],
  ),
  line(
    "daishi",
    "大師線",
    ["京急大師線", "Daishi Line"],
    ["大師線", "京急大師線", "Daishi", "Daishi Line"],
    [["京急川崎"], ["小島新田"]],
  ),
  line(
    "zushi",
    "逗子線",
    ["京急逗子線", "Zushi Line"],
    ["逗子線", "京急逗子線", "Zushi", "Zushi Line"],
    [["金沢八景"], ["逗子・葉山", "逗子葉山", "新逗子"]],
  ),
  line(
    "kurihama",
    "久里浜線",
    ["京急久里浜線", "Kurihama Line"],
    ["久里浜線", "京急久里浜線", "Kurihama", "Kurihama Line"],
    [["堀ノ内"], ["三崎口"]],
  ),
];

function toPublicCatalog(
  definition: KeikyuCatalogDefinition,
): RailwayCatalogLine {
  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    color: definition.color,
    aliases: definition.aliases,
    coverage: definition.coverage,
    coverageNote: definition.coverageNote,
    kind: definition.kind,
  };
}

export const RAILWAY_CATALOG: RailwayCatalogLine[] =
  DEFINITIONS.map(toPublicCatalog);

function normalizeIdentity(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[・･·\s_\-:().（）]/g, "")
    .replace(/駅$/, "");
}

export interface KeikyuRailwayIdentityEvidence {
  title: string;
  stationTitles: readonly string[];
}

/**
 * 実レスポンスの title と stationOrder だけから5路線を厳密に識別する。
 * ID の末尾や部分一致にはフォールバックしないため、未知の路線を誤採用しない。
 */
export function identifyKeikyuRailway(
  evidence: KeikyuRailwayIdentityEvidence,
): RailwayCatalogLine | null {
  const title = normalizeIdentity(evidence.title);
  const stations = new Set(evidence.stationTitles.map(normalizeIdentity));

  const match = DEFINITIONS.find((definition) => {
    const titleMatches = definition.identityTitles
      .map(normalizeIdentity)
      .includes(title);
    if (!titleMatches) return false;

    const [firstCandidates, secondCandidates] = definition.identityStations;
    const hasFirst = firstCandidates
      .map(normalizeIdentity)
      .some((candidate) => stations.has(candidate));
    const hasSecond = secondCandidates
      .map(normalizeIdentity)
      .some((candidate) => stations.has(candidate));
    return hasFirst && hasSecond;
  });

  if (!match) return null;
  return toPublicCatalog(match);
}

/**
 * 旧呼び出しとの互換ラッパー。odptId は意図的に判定へ使わない。
 */
export function findRailwayCatalogLine(
  _odptId: string,
  title: string,
  stationTitles: readonly string[] = [],
): RailwayCatalogLine | null {
  return identifyKeikyuRailway({ title, stationTitles });
}

export function railwayFilterOptions(
  availableIds: ReadonlySet<string>,
): RailwayFilterOption[] {
  return RAILWAY_CATALOG.map((item) => ({
    ...item,
    available: availableIds.has(item.id),
  }));
}

/** 初期表示はカタログ順で最初に利用できる路線（通常は京急本線）。 */
export function defaultVisibleRailwayIds(
  options: readonly RailwayFilterOption[],
): Set<string> {
  const firstAvailable = options.find((option) => option.available);
  return new Set(firstAvailable ? [firstAvailable.id] : []);
}

export function getRailwayCatalogLine(
  id: string,
): RailwayCatalogLine | undefined {
  return RAILWAY_CATALOG.find((item) => item.id === id);
}
