import { MOCK_KEIKYU_LINES } from "@/data/routeLine";
import type { Station } from "@/types/geo";

/**
 * 既存のルート計算コード向けのモック駅一覧。
 * ライブ ODPT データの駅順・座標には使用しない。
 */
export const STATIONS: Station[] = MOCK_KEIKYU_LINES.flatMap((line) =>
  line.stations.map((station) => {
    const [longitude, latitude] = line.coordinates[station.pointIndex];
    return {
      id: `${line.id}:${station.id}`,
      name: station.name,
      latitude,
      longitude,
    };
  }),
);

export function getStationById(id: string): Station | undefined {
  return STATIONS.find((station) => station.id === id);
}
