import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const db = {
  teams: {
    async getAll() {
      return prisma.team.findMany({
        orderBy: { name: "asc" },
      });
    },

    async getById(id: number) {
      return prisma.team.findUnique({
        where: { id },
        include: {
          players: true,
          draftPicks: true,
        },
      });
    },

    async getByAbbreviation(abbreviation: string) {
      return prisma.team.findUnique({
        where: { abbreviation },
        include: {
          players: true,
          draftPicks: true,
        },
      });
    },

    async getRoster(teamId: number) {
      return prisma.player.findMany({
        where: { teamId },
        orderBy: { salary: "desc" },
      });
    },
  },

  players: {
    async getByTeam(teamId: number) {
      return prisma.player.findMany({
        where: { teamId },
        include: { team: true },
        orderBy: { salary: "desc" },
      });
    },

    async search(query: string) {
      return prisma.player.findMany({
        where: {
          name: {
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
      return prisma.trade.create({
        data,
      });
    },

    async getById(id: number) {
      return prisma.trade.findUnique({
        where: { id },
        include: {
          players: true,
          draftPicks: true,
        },
      });
    },

    async getAll() {
      return prisma.trade.findMany({
        include: {
          players: true,
          draftPicks: true,
        },
      });
    },
  },

  draftPicks: {
    async getByTeam(teamId: number) {
      return prisma.draftPick.findMany({
        where: { currentTeamId: teamId },
        include: {
          originalTeam: true,
          currentTeam: true,
        },
        orderBy: [{ year: "asc" }, { round: "asc" }],
      });
    },

    async getByYear(year: number) {
      return prisma.draftPick.findMany({
        where: { year },
        include: {
          originalTeam: true,
          currentTeam: true,
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
