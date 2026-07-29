import { RAILWAY_CATALOG } from "@/data/railwayCatalog";
import {
  fetchOdptTrainInformationForOperator,
  fetchOdptTrainsForOperator,
} from "@/lib/odpt/api";
import {
  getOdptConfig,
  isOdptConfigured,
  type OdptConfig,
} from "@/lib/odpt/config";
import {
  applyOfficialWholeLineSuspensions,
  odptInformationToServiceStatus,
  odptTrainsToNetworkTrainLocations,
} from "@/lib/odpt/mapper";
import { getOdptNetworkContext } from "@/lib/odpt/network";
import { createLogger } from "@/lib/logger";
import type { TrainLocationProvider } from "@/providers/TrainLocationProvider";
import type { ServiceStatus, TrainLocation } from "@/types/train";

/**
 * 京急チャレンジ2026 ODPT プロバイダ。
 *
 * UI はこの具象クラスを参照せず、trainLocationService を通して利用する。
 */
export class KeikyuTrainLocationProvider
  implements TrainLocationProvider
{
  public readonly isMock = false;
  private readonly log = createLogger("keikyu.odpt.provider");

  constructor(private readonly config: OdptConfig = getOdptConfig()) {}

  isAvailable(): boolean {
    return isOdptConfigured(this.config);
  }

  async getTrainLocations(): Promise<TrainLocation[]> {
    const informationRequest = fetchOdptTrainInformationForOperator(
      this.config.operator,
      this.config,
    ).catch((error: unknown) => {
      this.log.warn(
        "運行情報の取得に失敗したため列車アイコン状態を変更しない",
        {
          errorType:
            error instanceof Error ? error.name : "UnknownError",
        },
      );
      return null;
    });
    const [{ data, durationMs }, network, informationResult] =
      await Promise.all([
      fetchOdptTrainsForOperator(this.config.operator, this.config),
      getOdptNetworkContext(this.config),
      informationRequest,
    ]);
    const mappedTrains = odptTrainsToNetworkTrainLocations(data, network);
    const trains = applyOfficialWholeLineSuspensions(
      mappedTrains,
      informationResult?.data ?? null,
      network.catalogIdByOdptRailwayId,
    );

    this.log.info("列車位置を変換", {
      raw: data.length,
      mapped: trains.length,
      lines: new Set(trains.map((train) => train.lineId)).size,
      wholeLineSuspended: trains.filter(
        (train) => train.status === "suspended",
      ).length,
      trainInformationAvailable: informationResult !== null,
      durationMs,
    });
    return trains;
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    const statuses = await this.getServiceStatuses();
    const status =
      statuses.find((item) => item.lineId === "main") ?? statuses[0];
    if (!status) {
      throw new Error("識別済み京急路線の運行情報がありません");
    }
    return status;
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    const [{ data, durationMs }, network] = await Promise.all([
      fetchOdptTrainInformationForOperator(
        this.config.operator,
        this.config,
      ),
      getOdptNetworkContext(this.config),
    ]);

    const statuses = RAILWAY_CATALOG.flatMap((catalog) => {
      const railway = network.railwayByCatalogId.get(catalog.id);
      if (!railway) return [];
      const matching = data.filter(
        (item) => {
          const railwayIds = item["odpt:railway"];
          return Array.isArray(railwayIds)
            ? railwayIds.includes(railway.odptId)
            : railwayIds === railway.odptId;
        },
      );
      return [
        odptInformationToServiceStatus(
          matching,
          catalog.name,
          catalog.id,
        ),
      ];
    });

    this.log.info("路線別運行情報を変換", {
      raw: data.length,
      attributed: data.filter((item) => {
        const railwayIds = item["odpt:railway"];
        return (Array.isArray(railwayIds) ? railwayIds : [railwayIds]).some(
          (railwayId) =>
            railwayId
              ? network.railwayByOdptId.has(railwayId)
              : false,
        );
      }).length,
      mapped: statuses.length,
      disrupted: statuses.filter((status) => status.severity !== "normal")
        .length,
      durationMs,
    });
    return statuses;
  }
}
