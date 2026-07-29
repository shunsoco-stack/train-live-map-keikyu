/** ODPT API で使われる多言語文字列。 */
export type OdptLocalizedText =
  | string
  | {
      ja?: string;
      en?: string;
      "ja-Hrkt"?: string;
    };

export interface OdptGeoJsonFeature {
  type?: "Feature";
  geometry?: {
    type?: "Point" | "LineString" | "MultiLineString";
    coordinates?: unknown;
  } | null;
}

/** odpt:Train */
export interface OdptTrain {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:date"?: string;
  "dct:valid"?: string;
  /** 一部の過去データとの互換用。正式な有効期限フィールドは dct:valid。 */
  "odpt:valid"?: string;
  "odpt:frequency"?: number;
  "odpt:railway"?: string;
  "odpt:operator"?: string;
  "odpt:trainNumber"?: string;
  "odpt:trainType"?: string;
  "odpt:trainTypeTitle"?: OdptLocalizedText;
  "odpt:trainName"?: OdptLocalizedText[];
  "odpt:fromStation"?: string | null;
  "odpt:fromStationTitle"?: OdptLocalizedText;
  "odpt:toStation"?: string | null;
  "odpt:toStationTitle"?: OdptLocalizedText;
  "odpt:railDirection"?: string | null;
  /** 遅延秒数。フィールド自体が無い場合と 0 秒を区別する。 */
  "odpt:delay"?: number;
  "odpt:originStation"?: string | Array<string | null>;
  "odpt:destinationStation"?: string | Array<string | null>;
  "odpt:destinationStationTitle"?:
    | OdptLocalizedText
    | OdptLocalizedText[];
  /** 一部事業者が旧フィールド名で返す場合がある。 */
  "odpt:startingStation"?: string | Array<string | null>;
  "odpt:terminalStation"?: string | Array<string | null>;
  "odpt:viaRailway"?: string[];
  "odpt:viaStation"?: string[];
  "odpt:trainOwner"?: string;
  "geo:lat"?: number;
  "geo:long"?: number;
}

export interface OdptStationOrderEntry {
  "odpt:index"?: number;
  "odpt:station"?: string;
  "odpt:stationTitle"?: OdptLocalizedText;
}

/** odpt:Railway */
export interface OdptRailway {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:date"?: string;
  "dc:title"?: string;
  "odpt:operator"?: string;
  "odpt:railwayTitle"?: OdptLocalizedText;
  "odpt:color"?: string;
  "odpt:ascendingRailDirection"?: string;
  "odpt:descendingRailDirection"?: string;
  "odpt:stationOrder"?: OdptStationOrderEntry[];
  "ug:region"?: OdptGeoJsonFeature;
}

/** odpt:Station */
export interface OdptStation {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:date"?: string;
  "dc:title"?: string;
  "odpt:operator"?: string;
  "odpt:railway"?: string;
  "odpt:stationTitle"?: OdptLocalizedText;
  "geo:lat"?: number;
  "geo:long"?: number;
  "ug:region"?: OdptGeoJsonFeature;
}

/** odpt:TrainInformation */
export interface OdptTrainInformation {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:date"?: string;
  "dct:valid"?: string;
  "odpt:timeOfOrigin"?: string;
  "odpt:operator"?: string;
  /** 複数路線を対象とする運行情報では配列になる場合がある。 */
  "odpt:railway"?: string | string[];
  "odpt:trainInformationText"?: OdptLocalizedText;
  "odpt:trainInformationStatus"?: OdptLocalizedText;
  "odpt:trainInformationKind"?: OdptLocalizedText;
  "odpt:trainInformationCause"?: OdptLocalizedText;
}

/** odpt:Operator */
export interface OdptOperator {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:title"?: string;
  "odpt:operatorTitle"?: OdptLocalizedText;
}

/** odpt:RailDirection */
export interface OdptRailDirection {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:title"?: string;
  "odpt:railDirectionTitle"?: OdptLocalizedText;
}

/** odpt:TrainType */
export interface OdptTrainType {
  "@id"?: string;
  "@type"?: string;
  "owl:sameAs"?: string;
  "dc:title"?: string;
  "odpt:operator"?: string;
  "odpt:trainTypeTitle"?: OdptLocalizedText;
}

export function pickOdptText(
  value: OdptLocalizedText | undefined,
  fallback = "",
): string {
  if (typeof value === "string") return value;
  return value?.ja ?? value?.["ja-Hrkt"] ?? value?.en ?? fallback;
}

export function odptEntityId(value: {
  "@id"?: string;
  "owl:sameAs"?: string;
}): string {
  return value["owl:sameAs"] ?? value["@id"] ?? "";
}
