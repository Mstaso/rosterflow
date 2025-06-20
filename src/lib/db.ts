import { PrismaClient } from "@prisma/client";

// Only create Prisma client if DATABASE_URL is available
const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

export const db = {
  teams: {
    async getAll() {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.team.findMany({
        orderBy: { displayName: "asc" },
      });
    },

    async getById(id: number) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.team.findUnique({
        where: { id },
        include: {
          players: true,
          draftPicks: true,
        },
      });
    },

    async getByAbbreviation(abbreviation: string) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.team.findFirst({
        where: { abbreviation },
        include: {
          players: true,
          draftPicks: true,
        },
      });
    },

    async getRoster(teamId: number) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.player.findMany({
        where: { teamId },
        orderBy: { fullName: "asc" },
      });
    },
  },

  players: {
    async getByTeam(teamId: number) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.player.findMany({
        where: { teamId },
        include: { team: true },
        orderBy: { fullName: "asc" },
      });
    },

    async search(query: string) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.player.findMany({
        where: {
          fullName: {
            contains: query,
            mode: "insensitive",
          },
        },
        include: { team: true },
        take: 10,
      });
    },
  },

  trades: {
    async create(data: any) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.trade.create({
        data,
      });
    },

    async getById(id: number) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.trade.findUnique({
        where: { id },
        include: {
          assets: {
            include: {
              player: true,
              draftPick: true,
            },
          },
          fromTeam: true,
          toTeam: true,
        },
      });
    },

    async getAll() {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.trade.findMany({
        include: {
          assets: {
            include: {
              player: true,
              draftPick: true,
            },
          },
          fromTeam: true,
          toTeam: true,
        },
      });
    },
  },

  draftPicks: {
    async getByTeam(teamId: number) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.draftPick.findMany({
        where: { teamId },
        include: {
          team: true,
        },
        orderBy: [{ year: "asc" }, { round: "asc" }],
      });
    },

    async getByYear(year: number) {
      if (!prisma) {
        throw new Error("Database not available");
      }
      return prisma.draftPick.findMany({
        where: { year },
        include: {
          team: true,
        },
        orderBy: { round: "asc" },
      });
    },
  },
};

// Type exports for use throughout the app
export type TeamWithRoster = Awaited<ReturnType<typeof db.teams.getById>>;
export type PlayerWithTeam = Awaited<
  ReturnType<typeof db.players.getByTeam>
>[0];
export type TradeWithAssets = Awaited<ReturnType<typeof db.trades.getById>>;
export type DraftPickWithTeams = Awaited<
  ReturnType<typeof db.draftPicks.getByTeam>
>[0];

export default prisma;
