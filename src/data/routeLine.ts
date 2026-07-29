import type { KeikyuLineId } from "@/data/railwayCatalog";
import type { LngLat, RouteLineFeature } from "@/types/geo";

export interface MockRailwayStation {
  id: string;
  name: string;
  pointIndex: number;
}

export interface MockRailwayLine {
  id: KeikyuLineId;
  name: string;
  color: string;
  coordinates: LngLat[];
  stations: MockRailwayStation[];
}

/**
 * API 未設定・障害時だけ表示するデモ用線形。
 *
 * ライブ位置の補完には使わない。京急本線は品川を北端とし、提供対象外の
 * 品川〜泉岳寺間を一切含めない。
 */
export const MOCK_KEIKYU_LINES: MockRailwayLine[] = [
  {
    id: "main",
    name: "京急本線",
    color: "#e60012",
    coordinates: [
      [139.7388, 35.6285], // 品川
      [139.7392, 35.6221],
      [139.7423, 35.609],
      [139.7345, 35.5786],
      [139.7237, 35.5607], // 京急蒲田
      [139.7004, 35.5328], // 京急川崎
      [139.6387, 35.4818],
      [139.6201, 35.4662], // 横浜
      [139.596, 35.409],
      [139.6214, 35.3429],
      [139.6201, 35.3312], // 金沢八景
      [139.663, 35.2806],
      [139.6705, 35.2639],
      [139.6854, 35.2631], // 堀ノ内
      [139.714, 35.251],
    ],
    stations: [
      { id: "shinagawa", name: "品川", pointIndex: 0 },
      { id: "keikyu-kamata", name: "京急蒲田", pointIndex: 4 },
      { id: "keikyu-kawasaki", name: "京急川崎", pointIndex: 5 },
      { id: "yokohama", name: "横浜", pointIndex: 7 },
      { id: "kanazawa-hakkei", name: "金沢八景", pointIndex: 10 },
      { id: "horinouchi", name: "堀ノ内", pointIndex: 13 },
      { id: "uraga", name: "浦賀", pointIndex: 14 },
    ],
  },
  {
    id: "airport",
    name: "空港線",
    color: "#e60012",
    coordinates: [
      [139.7237, 35.5607], // 京急蒲田
      [139.732, 35.553],
      [139.7401, 35.549],
      [139.7473, 35.548],
      [139.754, 35.549],
      [139.7677, 35.5491], // 羽田空港第1・第2ターミナル
    ],
    stations: [
      { id: "keikyu-kamata", name: "京急蒲田", pointIndex: 0 },
      {
        id: "haneda-terminal-1-2",
        name: "羽田空港第1・第2ターミナル",
        pointIndex: 5,
      },
    ],
  },
  {
    id: "daishi",
    name: "大師線",
    color: "#e60012",
    coordinates: [
      [139.7004, 35.5328], // 京急川崎
      [139.7136, 35.5359],
      [139.7256, 35.5358],
      [139.7374, 35.5344],
      [139.7477, 35.5348], // 小島新田
    ],
    stations: [
      { id: "keikyu-kawasaki", name: "京急川崎", pointIndex: 0 },
      { id: "kojimashinden", name: "小島新田", pointIndex: 4 },
    ],
  },
  {
    id: "zushi",
    name: "逗子線",
    color: "#e60012",
    coordinates: [
      [139.6201, 35.3312], // 金沢八景
      [139.6105, 35.318],
      [139.5927, 35.3063],
      [139.5804, 35.2953], // 逗子・葉山
    ],
    stations: [
      { id: "kanazawa-hakkei", name: "金沢八景", pointIndex: 0 },
      { id: "zushi-hayama", name: "逗子・葉山", pointIndex: 3 },
    ],
  },
  {
    id: "kurihama",
    name: "久里浜線",
    color: "#e60012",
    coordinates: [
      [139.6854, 35.2631], // 堀ノ内
      [139.7011, 35.249],
      [139.7021, 35.2315],
      [139.6841, 35.212],
      [139.6531, 35.184],
      [139.6335, 35.1775], // 三崎口
    ],
    stations: [
      { id: "horinouchi", name: "堀ノ内", pointIndex: 0 },
      { id: "misakiguchi", name: "三崎口", pointIndex: 5 },
    ],
  },
];

const MAIN_MOCK_LINE = MOCK_KEIKYU_LINES[0];

/** 既存の地図初期化コード向け互換エクスポート。 */
export const ROUTE_COORDINATES_RAW = MAIN_MOCK_LINE.coordinates;

export const ROUTE_LINE: RouteLineFeature = {
  type: "Feature",
  properties: {
    name: "京急本線（モック・品川〜浦賀）",
  },
  geometry: {
    type: "LineString",
    coordinates: ROUTE_COORDINATES_RAW,
  },
};
