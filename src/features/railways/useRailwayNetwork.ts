"use client";

import { useCallback, useEffect, useState } from "react";
import { RAILWAY_CATALOG, railwayFilterOptions } from "@/data/railwayCatalog";
import { fetchRailways } from "@/lib/apiClient";
import type {
  RailwayFilterOption,
  RailwayMapLine,
} from "@/types/railway";

interface RailwayNetworkState {
  lines: RailwayMapLine[];
  options: RailwayFilterOption[];
  loading: boolean;
}

export function useRailwayNetwork(): RailwayNetworkState {
  const [state, setState] = useState<RailwayNetworkState>({
    lines: [],
    options: railwayFilterOptions(new Set()),
    loading: true,
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchRailways(signal);
      setState({
        lines: response.lines,
        options: response.options,
        loading: false,
      });
    } catch {
      if (signal?.aborted) return;
      setState((previous) => ({ ...previous, loading: false }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void load(controller.signal);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [load]);

  return state;
}

export const ALL_RAILWAY_IDS = RAILWAY_CATALOG.map((line) => line.id);
