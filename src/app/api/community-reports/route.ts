import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { communityReporterHashSeed } from "@/lib/communityNamespace";
import {
  aggregateCommunityReports,
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
  validateCommunityReportVote,
} from "@/lib/communityReports";
import { getCommunityReportStore } from "@/server/communityReportStore";
import { maybeSendSuspensionSpikeNotification } from "@/server/pushNotifier";
import { requestNetworkHash } from "@/server/requestNetwork";
import type {
  CommunityReportsApiResponse,
  CommunityReportSubmitResponse,
} from "@/types/community";

export const dynamic = "force-dynamic";

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

function votingEnabled(request: NextRequest, persistent: boolean): boolean {
  return persistent || isLocalRequest(request);
}

async function responsePayload(
  request: NextRequest,
): Promise<CommunityReportsApiResponse> {
  const store = getCommunityReportStore();
  const reports = await store.listActive();
  return {
    summaries: aggregateCommunityReports(
      reports.map((item) => item.record),
    ),
    windowMinutes: COMMUNITY_REPORT_WINDOW_MS / 60_000,
    cooldownSeconds: COMMUNITY_REPORT_COOLDOWN_SECONDS,
    persistent: store.persistent,
    votingEnabled: votingEnabled(request, store.persistent),
  };
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await responsePayload(request));
  } catch {
    return NextResponse.json(
      { error: "みんなの情報を取得できませんでした。" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const store = getCommunityReportStore();
    if (!votingEnabled(request, store.persistent)) {
      return NextResponse.json(
        {
          error:
            "みんなの情報を保存する京急版専用KVが設定されていません。",
        },
        { status: 503 },
      );
    }

    const reporterId = request.headers.get("x-community-reporter") ?? "";
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(reporterId)) {
      return NextResponse.json(
        { error: "投稿端末を確認できませんでした。" },
        { status: 400 },
      );
    }

    const vote = validateCommunityReportVote(await request.json());
    const catalogLine = vote
      ? getRailwayCatalogLine(vote.lineId)
      : undefined;
    if (!vote || !catalogLine || catalogLine.coverage === "unavailable") {
      return NextResponse.json(
        { error: "投稿する路線と内容を確認してください。" },
        { status: 400 },
      );
    }

    const reporterHash = createHash("sha256")
      .update(communityReporterHashSeed(reporterId))
      .digest("hex")
      .slice(0, 32);
    const networkHash = requestNetworkHash(request.headers);
    const [reporterAllowed, networkAllowed] = await Promise.all([
      store.claimRateLimit(`reporter:${reporterHash}`, vote.lineId),
      store.claimRateLimit(`network:${networkHash}`, vote.lineId),
    ]);
    if (!reporterAllowed || !networkAllowed) {
      return NextResponse.json(
        {
          error:
            `同じ路線へ再投稿できるのは` +
            `${COMMUNITY_REPORT_COOLDOWN_SECONDS}秒後です。`,
        },
        { status: 429 },
      );
    }

    const createdAt = new Date().toISOString();
    await store.save({
      ...vote,
      reporterHash,
      networkHash,
      createdAt,
    });

    if (vote.status === "suspended") {
      try {
        const activeReports = await store.listActive();
        await maybeSendSuspensionSpikeNotification({
          reports: activeReports.map((item) => item.record),
          lineId: vote.lineId,
          lineName: catalogLine.name,
        });
      } catch {
        // Push失敗で利用者投稿自体を失敗扱いにしない。
      }
    }

    const payload = await responsePayload(request);
    const summary = payload.summaries.find(
      (item) => item.lineId === vote.lineId,
    );
    if (!summary) {
      throw new Error("投稿結果を集計できませんでした。");
    }

    const response: CommunityReportSubmitResponse = {
      ...payload,
      summary,
    };
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "みんなの情報を保存できませんでした。" },
      { status: 500 },
    );
  }
}
