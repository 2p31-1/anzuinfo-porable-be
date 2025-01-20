import { Injectable } from '@nestjs/common';
import { Playdata, Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

import { PlaydataWithChartAndSong } from '../model/playdata-chart-and-song.model';
import { PlaydataUser } from '../model/playdata-user.model';
import { PlaydataVS } from '../model/playdata-vs.model';
import { FilterDto } from '../dto/request/filter.dto';
interface playdata {
  accountIdx: number;
  chartIdx: number;
  chartVf: number;
  rank: number;
  score: number;
}
@Injectable()
export class PlaydataRepository {
  constructor(private readonly prismaService: PrismaService) {}
  async insertPlaydata(
    accountIdx: number,
    chartIdx: number,
    chartVf: number,
    rank: number,
    score: number,
    prismaTx: Prisma.TransactionClient | null,
  ): Promise<void> {
    const prisma = prismaTx ? prismaTx : this.prismaService;
    await prisma.playdata.create({
      data: {
        account: { connect: { idx: accountIdx } },
        chart: { connect: { idx: chartIdx } },
        chartVf: chartVf,
        rank: rank,
        score: score,
      },
    });
  }

  async insertPlaydataList(playdataList: playdata[]): Promise<void> {
    await this.prismaService.playdata.createMany({
      data: playdataList,
    });
  }

  async selectVF(accountIdx: number, updatedAt: Date): Promise<Playdata[]> {
    return await this.prismaService.playdata.findMany({
      where: {
        accountIdx: accountIdx,
        createdAt: updatedAt,
      },
      orderBy: {
        chartVf: 'desc',
      },
      take: 50,
    });
  }
  async selectPlaydataByChart(
    accountIdx: number,
    updatedAt: Date,
    chartIdx: number,
  ): Promise<Playdata | null> {
    return await this.prismaService.playdata.findFirst({
      where: {
        accountIdx: accountIdx,
        chartIdx: chartIdx,
        createdAt: updatedAt,
      },
    });
  }
  async selectPlaydataAll(
    accountIdx: number,
    updatedAt: Date,
  ): Promise<Playdata[]> {
    return await this.prismaService.playdata.findMany({
      where: {
        accountIdx: accountIdx,
        createdAt: updatedAt,
      },
      orderBy: {
        chartIdx: 'asc',
      },
    });
  }

  async selectVsData(accountIdx: number, targetIdx: number, page: number) {
    return await this.prismaService.playdata.findMany({
      where: {
        accountIdx: accountIdx,
      },
      orderBy: {
        chartIdx: 'asc',
      },
    });
  }

  async selectPlaydataByLevel(
    accountIdx: number,
    updatedAt: Date,
    level: number,
  ): Promise<Playdata[]> {
    return await this.prismaService.playdata.findMany({
      where: {
        accountIdx: accountIdx,
        createdAt: updatedAt,
        chart: {
          level: level,
        },
      },

      orderBy: {
        score: 'desc',
      },
    });
  }

  async selectPlaydataRankingByChart(
    chartIdx: number,
  ): Promise<PlaydataUser[]> {
    return await this.prismaService.playdata.findMany({
      where: {
        chartIdx: chartIdx,
        account: {
          deletedAt: null,
        },
      },
      include: {
        account: {
          select: {
            idx: true,
            sdvxId: true,
            playerName: true,
            skillLevel: true,
            updatedAt: true,
            vf: true,
          },
        },
      },
      orderBy: {
        score: 'desc',
      },
    });
  }

  async selectVSDataPrisma(
    userAccountIdx: number,
    targetAccountIdx: number,
    page: number,
    limit = 20,
  ): Promise<PlaydataVS[]> {
    const offset = (page - 1) * limit;
    const result = await this.prismaService.$queryRaw<PlaydataVS[]>`
      SELECT
          COALESCE(my.chart_idx, rival.chart_idx) AS "chartIdx",
          json_build_object('score', my.score, 'rank', my.rank) AS playdata,
          json_build_object('score', rival.score, 'rank', rival.rank) AS "rivalPlaydata"
      FROM (
          SELECT playdata.chart_idx, playdata.score, playdata.rank
          FROM playdata
          JOIN account ON playdata.account_idx = account.idx
          WHERE account.idx = ${userAccountIdx} AND playdata.created_at = account.update_at
      ) my
      FULL OUTER JOIN (
          SELECT playdata.chart_idx, playdata.score, playdata.rank
          FROM playdata
          JOIN account  ON playdata.account_idx = account.idx
          WHERE account.idx = ${targetAccountIdx} AND playdata.created_at = account.update_at
      ) rival
      ON my.chart_idx = rival.chart_idx
      WHERE my.chart_idx IS NOT NULL OR rival.chart_idx IS NOT NULL
      ORDER BY "chartIdx" ASC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return result;
  }

  async selectPlaydataByFilter(
    accountIdx: number,
    updatedAt: Date,
    clearRankFilter: number[],
    scoreFilter: number[],
    levelFilter: number[],
    keyword: string,
  ): Promise<Playdata[]> {
    const result = await this.prismaService.playdata.findMany({
      where: {
        accountIdx: accountIdx,
        scoreIdx: scoreFilter?.length
          ? {
              in: scoreFilter,
            }
          : undefined,
        rank: clearRankFilter?.length
          ? {
              in: clearRankFilter,
            }
          : undefined,
        chart: {
          level: levelFilter?.length
            ? {
                in: levelFilter,
              }
            : undefined,
          song: {
            title: keyword
              ? {
                  contains: keyword,
                  mode: 'insensitive',
                }
              : undefined,
          },
        },

        createdAt: updatedAt,
      },
      orderBy: {
        chartIdx: 'asc',
      },
    });
    return result;
  }
}
