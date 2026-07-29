"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TrainLocation } from "@/types/train";
import type { RailwayMapLine } from "@/types/railway";
import type { LngLat } from "@/types/geo";
import { MAP_STYLE } from "@/features/map/mapStyle";
import { getStatusAppearance } from "@/lib/trainStatus";
import {
  DEFAULT_MAP_BOUNDS,
  getVisibleRailwayBounds,
} from "@/lib/mapViewport";
import {
  buildPolylineIndex,
  positionAtFraction,
  type PolylineIndex,
} from "@/lib/geo";
import { buildSnapshotTransitionPath } from "@/lib/trainMotion";

interface TrainMapInnerProps {
  trains: TrainLocation[];
  railwayLines: RailwayMapLine[];
  visibleLineIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 色再計算のための現在時刻(1秒ごとに更新される) */
  now: Date;
}

interface TrainMotionState {
  startedAt: number;
  durationMs: number;
  routeIndex: PolylineIndex;
  marker: maplibregl.Marker;
}

interface RouteProjection {
  routeIndex: PolylineIndex;
  fraction: number;
  distanceSquared: number;
}

/** 7秒ポーリングの次回取得直前まで、直前座標から最新座標へ滑らかに追従する。 */
const SNAPSHOT_TWEEN_MS = 6400;
const ROUTE_LABEL_PIXEL_RATIO = 2;

function projectToPolyline(
  routeIndex: PolylineIndex,
  coordinate: LngLat,
): RouteProjection {
  const [targetLongitude, targetLatitude] = coordinate;
  const longitudeScale = Math.cos((targetLatitude * Math.PI) / 180);
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  let nearestDistanceAlong = 0;

  for (let index = 1; index < routeIndex.points.length; index += 1) {
    const from = routeIndex.points[index - 1];
    const to = routeIndex.points[index];
    const segmentLongitude = (to[0] - from[0]) * longitudeScale;
    const segmentLatitude = to[1] - from[1];
    const targetFromLongitude =
      (targetLongitude - from[0]) * longitudeScale;
    const targetFromLatitude = targetLatitude - from[1];
    const segmentLengthSquared =
      segmentLongitude * segmentLongitude +
      segmentLatitude * segmentLatitude;
    const segmentFraction =
      segmentLengthSquared === 0
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              (targetFromLongitude * segmentLongitude +
                targetFromLatitude * segmentLatitude) /
                segmentLengthSquared,
            ),
          );
    const projectedLongitude =
      from[0] + (to[0] - from[0]) * segmentFraction;
    const projectedLatitude =
      from[1] + (to[1] - from[1]) * segmentFraction;
    const longitudeDelta =
      (targetLongitude - projectedLongitude) * longitudeScale;
    const latitudeDelta = targetLatitude - projectedLatitude;
    const distanceSquared =
      longitudeDelta * longitudeDelta + latitudeDelta * latitudeDelta;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      const segmentLength =
        routeIndex.cumulative[index] -
        routeIndex.cumulative[index - 1];
      nearestDistanceAlong =
        routeIndex.cumulative[index - 1] +
        segmentLength * segmentFraction;
    }
  }

  return {
    routeIndex,
    fraction:
      routeIndex.totalLength > 0
        ? nearestDistanceAlong / routeIndex.totalLength
        : 0,
    distanceSquared: nearestDistanceSquared,
  };
}

/**
 * ODPTが示した現在の駅間ポリラインへ最優先で投影する。
 * 駅間形状がないモック等だけ表示路線へフォールバックする。緯度経度を
 * 直接描画せず、ここで得たポリライン上の座標だけをマーカーへ渡す。
 */
function routeProjectionForTrain(
  train: TrainLocation,
  railwayLines: readonly RailwayMapLine[],
): RouteProjection | null {
  const target: LngLat = [train.longitude, train.latitude];
  const stationSegment = train.routeSegment?.coordinates;
  if (stationSegment && stationSegment.length >= 2) {
    return projectToPolyline(buildPolylineIndex(stationSegment), target);
  }

  const line = railwayLines.find((candidate) => candidate.id === train.lineId);
  if (line) {
    let best: RouteProjection | null = null;
    for (const path of line.coordinates) {
      if (path.length < 2) continue;
      const projection = projectToPolyline(buildPolylineIndex(path), target);
      if (!best || projection.distanceSquared < best.distanceSquared) {
        best = projection;
      }
    }
    if (best) return best;
  }

  return null;
}

function routeLabelText(name: string): string {
  return name.replace(/[（(][^）)]*[）)]/g, "").trim();
}

/**
 * ラスタ地図スタイルはglyphsを持たないため、路線名をCanvasで画像化する。
 * MapLibreのsymbolレイヤーに載せることで、線路に沿った回転・重なり回避が効く。
 */
function createRouteLabelImage(name: string, lineColor: string): ImageData {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("路線名ラベル用のCanvasを初期化できませんでした。");
  }

  const fontSize = 12 * ROUTE_LABEL_PIXEL_RATIO;
  const horizontalPadding = 9 * ROUTE_LABEL_PIXEL_RATIO;
  const height = 24 * ROUTE_LABEL_PIXEL_RATIO;
  context.font = `800 ${fontSize}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
  const width = Math.ceil(
    Math.max(
      54 * ROUTE_LABEL_PIXEL_RATIO,
      context.measureText(name).width + horizontalPadding * 2,
    ),
  );

  canvas.width = width;
  canvas.height = height;

  context.font = `800 ${fontSize}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  const inset = 2 * ROUTE_LABEL_PIXEL_RATIO;
  const radius = 10 * ROUTE_LABEL_PIXEL_RATIO;
  context.beginPath();
  context.roundRect(
    inset,
    inset,
    width - inset * 2,
    height - inset * 2,
    radius,
  );
  context.fillStyle = "rgba(38, 11, 18, 0.92)";
  context.fill();
  context.lineWidth = 2 * ROUTE_LABEL_PIXEL_RATIO;
  context.strokeStyle = lineColor;
  context.stroke();

  context.fillStyle = "#fff6f8";
  context.shadowColor = "rgba(0, 0, 0, 0.45)";
  context.shadowBlur = ROUTE_LABEL_PIXEL_RATIO;
  context.fillText(name, width / 2, height / 2 + ROUTE_LABEL_PIXEL_RATIO / 2);

  return context.getImageData(0, 0, width, height);
}

/**
 * MapLibre GL による地図描画コンポーネント。
 * SSR では読み込まれない(dynamic import + ssr:false)前提のクライアント専用。
 */
export default function TrainMapInner({
  trains,
  railwayLines,
  visibleLineIds,
  selectedId,
  onSelect,
  now,
}: TrainMapInnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const trainMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const trainMotionRef = useRef<Map<string, TrainMotionState>>(new Map());
  const trainSnapshotKeysRef = useRef<Map<string, string>>(new Map());
  const trainSegmentsRef = useRef<Map<string, LngLat[]>>(new Map());
  // 最新の onSelect を参照するための ref(マーカー生成時のクロージャ固定を回避)
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const visibleBounds = useMemo(
    () => getVisibleRailwayBounds(railwayLines, visibleLineIds),
    [railwayLines, visibleLineIds],
  );

  // --- 地図の初期化(一度だけ) ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // クリーンアップ時に参照する Map を固定
    const trainMarkers = trainMarkersRef.current;
    const trainMotions = trainMotionRef.current;
    const trainSnapshotKeys = trainSnapshotKeysRef.current;
    const trainSegments = trainSegmentsRef.current;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: DEFAULT_MAP_BOUNDS,
      fitBoundsOptions: { padding: 40, maxZoom: 10.5 },
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      loadedRef.current = true;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      setMapReady(false);
      trainMarkers.clear();
      trainMotions.clear();
      trainSnapshotKeys.clear();
      trainSegments.clear();
    };
  }, []);

  // --- 路線レイヤーの追加・表示切り替え ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeSourceIds = new Set<string>();
    for (const line of railwayLines) {
      const sourceId = `railway-route-${line.id}`;
      const casingId = `${sourceId}-casing`;
      const lineId = `${sourceId}-line`;
      const labelId = `${sourceId}-label`;
      const labelImageId = `${sourceId}-label-image`;
      activeSourceIds.add(sourceId);

      const data = {
        type: "Feature" as const,
        properties: { id: line.id, name: line.name },
        geometry: {
          type: "MultiLineString" as const,
          coordinates: line.coordinates,
        },
      };

      const source = map.getSource(sourceId) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(sourceId, { type: "geojson", data });
      }

      if (!map.hasImage(labelImageId)) {
        map.addImage(
          labelImageId,
          createRouteLabelImage(routeLabelText(line.name), line.color),
          { pixelRatio: ROUTE_LABEL_PIXEL_RATIO },
        );
      }

      if (!map.getLayer(casingId)) {
        map.addLayer({
          id: casingId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#35101a",
            "line-width": 7,
            "line-opacity": 0.85,
          },
        });
      }
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": line.color,
            "line-width": 4,
            "line-opacity": 0.9,
          },
        });
      }
      if (!map.getLayer(labelId)) {
        map.addLayer({
          id: labelId,
          type: "symbol",
          source: sourceId,
          minzoom: 7,
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 250,
            "icon-image": labelImageId,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7,
              0.82,
              11,
              1,
              14,
              1.08,
            ],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-keep-upright": true,
            "icon-padding": 7,
            "icon-allow-overlap": false,
            "icon-ignore-placement": false,
          },
        });
      }

      const visibility = visibleLineIds.has(line.id) ? "visible" : "none";
      if (map.getLayer(casingId)) {
        map.setLayoutProperty(casingId, "visibility", visibility);
      }
      if (map.getLayer(lineId)) {
        map.setLayoutProperty(lineId, "visibility", visibility);
        map.setPaintProperty(lineId, "line-color", line.color);
      }
      if (map.getLayer(labelId)) {
        map.setLayoutProperty(labelId, "visibility", visibility);
      }
    }

    const style = map.getStyle();
    for (const sourceId of Object.keys(style.sources ?? {})) {
      if (
        !sourceId.startsWith("railway-route-") ||
        activeSourceIds.has(sourceId)
      ) {
        continue;
      }
      const casingId = `${sourceId}-casing`;
      const lineId = `${sourceId}-line`;
      const labelId = `${sourceId}-label`;
      const labelImageId = `${sourceId}-label-image`;
      if (map.getLayer(labelId)) map.removeLayer(labelId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(casingId)) map.removeLayer(casingId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      if (map.hasImage(labelImageId)) map.removeImage(labelImageId);
    }
  }, [mapReady, railwayLines, visibleLineIds]);

  // --- 選択路線が画面の主役になるよう、表示範囲を自動調整 ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !visibleBounds) return;

    const compact = window.matchMedia("(max-width: 639px)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    map.stop();
    map.resize();
    map.fitBounds(visibleBounds, {
      padding: compact
        ? { top: 82, right: 30, bottom: 122, left: 30 }
        : { top: 76, right: 72, bottom: 84, left: 72 },
      maxZoom: 10.5,
      duration: reducedMotion ? 0 : 650,
    });
  }, [mapReady, visibleBounds]);

  // --- APIスナップショット間だけを、同じポリライン上で滑らかに補間 ---
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let animationFrame = 0;
    const animate = (timestamp: number) => {
      for (const [trainId, motion] of trainMotionRef.current) {
        const progress = reducedMotionQuery.matches
          ? 1
          : Math.min(
              1,
              Math.max(0, (timestamp - motion.startedAt) / motion.durationMs),
            );
        const easedProgress =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        const [longitude, latitude] = positionAtFraction(
          motion.routeIndex,
          easedProgress,
        );
        motion.marker.setLngLat([longitude, latitude]);

        if (progress >= 1) {
          trainMotionRef.current.delete(trainId);
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  // --- 列車マーカーの更新 ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const markers = trainMarkersRef.current;
    const seen = new Set<string>();

    for (const train of trains) {
      const appearance = getStatusAppearance(train, now);
      const isSelected = train.id === selectedId;
      const projection = routeProjectionForTrain(train, railwayLines);

      // 路線形状へ投影できない列車は、線路外へ置かず安全に非表示にする。
      if (!projection) {
        const staleMarker = markers.get(train.id);
        staleMarker?.remove();
        markers.delete(train.id);
        trainMotionRef.current.delete(train.id);
        trainSnapshotKeysRef.current.delete(train.id);
        trainSegmentsRef.current.delete(train.id);
        continue;
      }

      seen.add(train.id);
      const targetKey = [
        train.lastUpdatedAt,
        train.longitude,
        train.latitude,
        train.routeSegment?.fromFraction ?? "",
        train.routeSegment?.toFraction ?? "",
      ].join(":");
      const segmentMinimum = train.routeSegment
        ? Math.min(
            train.routeSegment.fromFraction,
            train.routeSegment.toFraction,
          )
        : 0;
      const segmentMaximum = train.routeSegment
        ? Math.max(
            train.routeSegment.fromFraction,
            train.routeSegment.toFraction,
          )
        : 1;
      const targetFraction = Math.min(
        segmentMaximum,
        Math.max(segmentMinimum, projection.fraction),
      );
      const targetCoordinate = positionAtFraction(
        projection.routeIndex,
        targetFraction,
      );

      let marker = markers.get(train.id);
      if (!marker) {
        const el = createTrainElement();
        el.addEventListener("click", () => onSelectRef.current(train.id));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectRef.current(train.id);
          }
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" });
        marker.setLngLat(targetCoordinate).addTo(map);
        markers.set(train.id, marker);
      }

      const previousTargetKey = trainSnapshotKeysRef.current.get(train.id);
      if (previousTargetKey !== targetKey) {
        const currentLngLat = marker.getLngLat();
        const previousSegment = trainSegmentsRef.current.get(train.id);
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        if (
          previousTargetKey === undefined ||
          reducedMotion ||
          !previousSegment
        ) {
          marker.setLngLat(targetCoordinate);
          trainMotionRef.current.delete(train.id);
        } else {
          const transition = buildSnapshotTransitionPath({
            current: [currentLngLat.lng, currentLngLat.lat],
            previousSegment,
            nextSegment: projection.routeIndex.points,
            target: targetCoordinate,
          });
          if (transition?.kind === "animate") {
            trainMotionRef.current.set(train.id, {
              startedAt: performance.now(),
              durationMs: SNAPSHOT_TWEEN_MS,
              routeIndex: buildPolylineIndex(transition.coordinates),
              marker,
            });
          } else {
            marker.setLngLat(
              transition?.kind === "snap"
                ? transition.coordinate
                : targetCoordinate,
            );
            trainMotionRef.current.delete(train.id);
          }
        }
        trainSnapshotKeysRef.current.set(train.id, targetKey);
        trainSegmentsRef.current.set(
          train.id,
          projection.routeIndex.points.map(
            (coordinate) => [...coordinate] as LngLat,
          ),
        );
      }

      const directionLabel =
        train.direction === "inbound"
          ? "上り"
          : train.direction === "outbound"
            ? "下り"
            : "方向情報なし";
      const destinationLabel = train.destination
        ? `${train.destination}行`
        : "行先情報なし";
      const delayMinutes =
        typeof train.delayMinutes === "number"
          ? Math.max(0, Math.round(train.delayMinutes))
          : null;
      styleTrainElement(marker.getElement(), {
        color: appearance.color,
        ring: appearance.ring,
        symbol: appearance.symbol,
        label: `${train.lineName} ${directionLabel} ${destinationLabel} ${appearance.label}`,
        lineColor: train.lineColor,
        direction: train.direction,
        face:
          train.status === "suspended"
            ? "suspended"
            : train.status === "delayed" ||
                (delayMinutes !== null && delayMinutes > 0)
              ? "delayed"
              : "normal",
        delayMinutes:
          train.status === "suspended"
            ? null
            : delayMinutes,
        selected: isSelected,
      });
    }

    // 消えた列車のマーカーを削除
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
        trainMotionRef.current.delete(id);
        trainSnapshotKeysRef.current.delete(id);
        trainSegmentsRef.current.delete(id);
      }
    }
  }, [now, railwayLines, selectedId, trains]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-label="京急線5路線の列車位置地図。ODPTの駅間情報から線路上へ推定した位置を表示"
      role="application"
    />
  );
}

/** 継承元の表情を生かした、公式ロゴを含まないオリジナルの赤い電車アイコン。 */
const TRAIN_ICON_SVG = `
<svg viewBox="0 0 32 32" class="h-[36px] w-[36px]" aria-hidden="true">
  <path d="M9 4.5h14c3 0 5 2.2 5 5v12.2c0 3.2-2.5 5.8-5.7 5.8H9.7C6.5 27.5 4 24.9 4 21.7V9.5c0-2.8 2-5 5-5Z"
        fill="none" stroke="#fffdf9" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M9 4.5h14c3 0 5 2.2 5 5v12.2c0 3.2-2.5 5.8-5.7 5.8H9.7C6.5 27.5 4 24.9 4 21.7V9.5c0-2.8 2-5 5-5Z"
        data-train-body fill="#e6002d" stroke="#4c111d" stroke-width="1.5"/>
  <rect x="7" y="7.5" width="18" height="10" rx="4" fill="#fffaf7" stroke="#493b38" stroke-width="1.2"/>
  <path data-line-band d="M6.2 19.3h19.6" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
  <g data-train-face="normal">
    <circle cx="11.5" cy="12.4" r="1.35" fill="#493b38"/>
    <circle cx="20.5" cy="12.4" r="1.35" fill="#493b38"/>
    <path d="M13.2 14.6c.8.9 1.7 1.3 2.8 1.3s2-.4 2.8-1.3"
          fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
  </g>
  <g data-train-face="delayed" style="display:none">
    <path d="m9.4 11.5 3.5-.9M19.1 10.6l3.5.9"
          fill="none" stroke="#493b38" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="11.5" cy="13" r="1.15" fill="#493b38"/>
    <circle cx="20.5" cy="13" r="1.15" fill="#493b38"/>
    <path d="M13.2 15.6c.8-.8 1.7-1.2 2.8-1.2s2 .4 2.8 1.2"
          fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
  </g>
  <g data-train-face="suspended" style="display:none">
    <path d="m9.3 11.5 3.6-.9M19.1 10.6l3.6.9"
          fill="none" stroke="#493b38" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M9.7 12.8c1.1.7 2.3.7 3.5 0M18.8 12.8c1.2.7 2.4.7 3.5 0"
          fill="none" stroke="#493b38" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M13.1 16c.8-.9 1.8-1.3 2.9-1.3s2.1.4 2.9 1.3"
          fill="none" stroke="#493b38" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M11.5 13.4v2.2M20.5 13.4v2.2"
          fill="none" stroke="#38bdf8" stroke-width="1.25" stroke-linecap="round"/>
    <circle cx="11.5" cy="16.1" r=".72" fill="#38bdf8" stroke="#258bb5" stroke-width=".3"/>
    <circle cx="20.5" cy="16.1" r=".72" fill="#38bdf8" stroke="#258bb5" stroke-width=".3"/>
  </g>
  <circle cx="9" cy="21.5" r="2" fill="#ffafc2"/>
  <circle cx="23" cy="21.5" r="2" fill="#ffafc2"/>
  <path d="M12 22.2h8" stroke="#493b38" stroke-width="1.4" stroke-linecap="round"/>
  <path d="m9 27.2-2 2.3M23 27.2l2 2.3" stroke="#493b38" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

/**
 * 列車マーカーの DOM 要素を生成する(スタイルは styleTrainElement で適用)。
 *
 * 構成:
 *   - 路線カラーで塗られた、表情のある電車アイコン
 *   - 状態記号のバッジ(色に依存せず状態がわかるようにする)
 */
function createTrainElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  // タップ領域を十分に確保
  el.className = "train-marker cursor-pointer outline-none";
  el.innerHTML = `
    <div data-pill class="relative flex h-[40px] w-[40px] items-center justify-center transition-transform">
      <span data-delay
            class="pointer-events-none absolute bottom-[calc(100%-1px)] left-1/2 z-10 hidden -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#e84462] px-2 py-1 text-[11px] font-black leading-none text-white whitespace-nowrap shadow-[0_2px_5px_rgba(0,0,0,0.38)]">
        <span data-delay-text></span>
        <span aria-hidden="true"
              class="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-[5px] rotate-45 border-b-2 border-r-2 border-white bg-[#e84462]"></span>
      </span>
      <span data-icon class="flex shrink-0 items-center">${TRAIN_ICON_SVG}</span>
      <span data-badge
            class="absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full border text-[9px] font-bold leading-none"></span>
      <span data-direction
            class="pointer-events-none absolute left-1/2 top-[calc(100%+2px)] -translate-x-1/2 rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none text-white whitespace-nowrap shadow-md"></span>
    </div>
  `;
  return el;
}

interface TrainStyleArgs {
  color: string;
  ring: string;
  symbol: string;
  label: string;
  lineColor: string;
  direction: TrainLocation["direction"];
  face: "normal" | "delayed" | "suspended";
  delayMinutes: number | null;
  selected: boolean;
}

function styleTrainElement(el: HTMLElement, args: TrainStyleArgs): void {
  el.setAttribute(
    "aria-label",
    args.delayMinutes !== null && args.delayMinutes > 0
      ? `${args.label} ${args.delayMinutes}分遅れ`
      : args.label,
  );
  const pill = el.querySelector<HTMLElement>("[data-pill]");
  const trainBody = el.querySelector<SVGElement>("[data-train-body]");
  const lineBand = el.querySelector<SVGElement>("[data-line-band]");
  const faces =
    el.querySelectorAll<SVGGElement>("[data-train-face]");
  const badge = el.querySelector<HTMLElement>("[data-badge]");
  const direction = el.querySelector<HTMLElement>("[data-direction]");
  const delay = el.querySelector<HTMLElement>("[data-delay]");
  const delayText = el.querySelector<HTMLElement>("[data-delay-text]");

  el.style.zIndex = args.selected ? "20" : "";
  el.dataset.selected = args.selected ? "true" : "false";
  if (pill) {
    pill.style.transform = args.selected ? "scale(1.18)" : "scale(1)";
    pill.style.filter = args.selected
      ? "drop-shadow(0 0 4px rgba(255,255,255,0.95)) drop-shadow(0 4px 4px rgba(0,0,0,0.55))"
      : "drop-shadow(0 3px 3px rgba(0,0,0,0.48))";
  }
  if (trainBody) {
    trainBody.style.fill = "#e6002d";
    trainBody.style.stroke = args.lineColor;
  }
  if (lineBand) lineBand.style.stroke = "#fff6f8";
  for (const face of faces) {
    face.style.display =
      face.dataset.trainFace === args.face ? "inline" : "none";
  }
  if (delay && delayText) {
    const showDelay = args.delayMinutes !== null && args.delayMinutes > 0;
    delay.style.display = showDelay ? "flex" : "none";
    delayText.textContent =
      showDelay ? `+${args.delayMinutes}分` : "";
  }
  if (direction) {
    const isInbound = args.direction === "inbound";
    const isOutbound = args.direction === "outbound";
    direction.textContent = isInbound
      ? "↑ 上り"
      : isOutbound
        ? "↓ 下り"
        : "方向不明";
    direction.style.backgroundColor = isInbound
      ? "#1e3a8a"
      : isOutbound
        ? "#86132d"
        : "#4b5563";
    direction.style.borderColor = isInbound
      ? "#93c5fd"
      : isOutbound
        ? "#ff9bae"
        : "#d1d5db";
  }
  if (badge) {
    // 通常走行時は余分な三角記号を出さず、注意が必要な状態だけ表示する。
    badge.style.display = args.symbol === "▶" ? "none" : "flex";
    badge.textContent = args.symbol;
    badge.style.backgroundColor = args.ring;
    badge.style.borderColor = args.color;
    badge.style.color = "#ffffff";
  }
}
