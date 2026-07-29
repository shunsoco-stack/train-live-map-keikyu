import assert from "node:assert/strict";
import test from "node:test";
import { projectPointToPolyline } from "./odpt/geometry.ts";
import {
  buildSnapshotTransitionPath,
  type SnapshotTransitionPath,
} from "./trainMotion.ts";
import type { LngLat } from "../types/geo.ts";

function animated(
  transition: SnapshotTransitionPath | null,
): LngLat[] {
  assert.ok(transition);
  assert.equal(transition.kind, "animate");
  return transition.kind === "animate" ? transition.coordinates : [];
}

test("駅間切替時は前区間の残りから完全一致する駅端点を通り次区間へ進む", () => {
  const previous: LngLat[] = [
    [0, 0],
    [1, 0],
    [1, 1],
  ];
  const next: LngLat[] = [
    [1, 1],
    [2, 1],
    [2, 2],
  ];
  const coordinates = animated(
    buildSnapshotTransitionPath({
      current: [0.5, 0],
      previousSegment: previous,
      nextSegment: next,
      target: [2, 1.5],
    }),
  );

  assert.deepEqual(coordinates, [
    [0.5, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 1.5],
  ]);
  assert.equal(
    coordinates.filter(
      (coordinate) => coordinate[0] === 1 && coordinate[1] === 1,
    ).length,
    1,
  );
});

test("構築した遷移線形の各線分は前後どちらかの駅間ポリライン上にある", () => {
  const previous: LngLat[] = [
    [139.7, 35.5],
    [139.71, 35.51],
    [139.72, 35.5],
  ];
  const next: LngLat[] = [
    [139.72, 35.5],
    [139.73, 35.49],
    [139.74, 35.5],
  ];
  const coordinates = animated(
    buildSnapshotTransitionPath({
      current: [139.705, 35.505],
      previousSegment: previous,
      nextSegment: next,
      target: [139.735, 35.495],
    }),
  );

  for (const coordinate of coordinates) {
    const previousDistance =
      projectPointToPolyline(coordinate, previous)
        ?.distanceToLineMeters ?? Number.POSITIVE_INFINITY;
    const nextDistance =
      projectPointToPolyline(coordinate, next)?.distanceToLineMeters ??
      Number.POSITIVE_INFINITY;
    assert.ok(
      Math.min(previousDistance, nextDistance) < 0.01,
      `${coordinate.join(",")} は駅間線形上にある`,
    );
  }
});

test("端点が完全一致しない駅間は直線で結ばず最新線形へスナップする", () => {
  const transition = buildSnapshotTransitionPath({
    current: [0.5, 0],
    previousSegment: [
      [0, 0],
      [1, 0],
    ],
    nextSegment: [
      [1.000001, 0],
      [2, 0],
    ],
    target: [1.5, 0.1],
  });
  assert.deepEqual(transition, {
    kind: "snap",
    coordinate: [1.5, 0],
  });
});

test("別の端点だけが一致しても走行方向と逆になる接続は作らない", () => {
  const transition = buildSnapshotTransitionPath({
    current: [0.5, 0],
    previousSegment: [
      [0, 0],
      [1, 0],
    ],
    nextSegment: [
      [2, 0],
      [0, 0],
    ],
    target: [1.5, 0],
  });
  assert.deepEqual(transition, {
    kind: "snap",
    coordinate: [1.5, 0],
  });
});

test("同じ駅間内の更新も、そのポリラインの部分線形だけで補間する", () => {
  const segment: LngLat[] = [
    [0, 0],
    [1, 1],
    [2, 0],
  ];
  const coordinates = animated(
    buildSnapshotTransitionPath({
      current: [0.5, 0.5],
      previousSegment: segment,
      nextSegment: segment,
      target: [1.5, 0.5],
    }),
  );
  assert.deepEqual(coordinates, [
    [0.5, 0.5],
    [1, 1],
    [1.5, 0.5],
  ]);
});

test("同じ駅間で目標が後退した補正値は逆向きにアニメーションしない", () => {
  const transition = buildSnapshotTransitionPath({
    current: [1.5, 0],
    previousSegment: [
      [0, 0],
      [2, 0],
    ],
    nextSegment: [
      [0, 0],
      [2, 0],
    ],
    target: [0.5, 0],
  });
  assert.deepEqual(transition, {
    kind: "snap",
    coordinate: [0.5, 0],
  });
});
