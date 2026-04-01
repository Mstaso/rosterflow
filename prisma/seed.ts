import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  log: ["info", "warn", "error"],
});

const openai = new OpenAI();

// NBA Conference and Division mappings
const NBA_DIVISIONS = {
  Atlantic: "Eastern",
  Central: "Eastern",
  Southeast: "Eastern",
  Northwest: "Western",
  Pacific: "Western",
  Southwest: "Western",
};

// ESPN Team ID to Division mapping
const TEAM_DIVISIONS: Record<string, string> = {
  "1": "Southeast", // Atlanta Hawks
  "2": "Atlantic", // Boston Celtics
  "3": "Atlantic", // Brooklyn Nets
  "4": "Southeast", // Charlotte Hornets
  "5": "Central", // Chicago Bulls
  "6": "Central", // Cleveland Cavaliers
  "7": "Southwest", // Dallas Mavericks
  "8": "Northwest", // Denver Nuggets
  "9": "Central", // Detroit Pistons
  "10": "Pacific", // Golden State Warriors
  "11": "Southwest", // Houston Rockets
  "12": "Central", // Indiana Pacers
  "13": "Pacific", // LA Clippers
  "14": "Pacific", // LA Lakers
  "15": "Southwest", // Memphis Grizzlies
  "16": "Southeast", // Miami Heat
  "17": "Central", // Milwaukee Bucks
  "18": "Northwest", // Minnesota Timberwolves
  "19": "Southwest", // New Orleans Pelicans
  "20": "Atlantic", // New York Knicks
  "21": "Northwest", // Oklahoma City Thunder
  "22": "Southeast", // Orlando Magic
  "23": "Atlantic", // Philadelphia 76ers
  "24": "Pacific", // Phoenix Suns
  "25": "Northwest", // Portland Trail Blazers
  "26": "Pacific", // Sacramento Kings
  "27": "Southwest", // San Antonio Spurs
  "28": "Atlantic", // Toronto Raptors
  "29": "Northwest", // Utah Jazz
  "30": "Southeast", // Washington Wizards
};

// Read and transform the JSON data to match the expected format
const capDataPath = path.join(
  __dirname,
  "seeddata",
  "nba_all_teams_cap_data.json"
);
const capData = JSON.parse(fs.readFileSync(capDataPath, "utf8"));

interface CapDataTeam {
  team: string;
  totalCapAllocations: number;
  capSpace: number;
  firstApronSpace: number;
  SecondApronSpace: number;
}

const salaryCapData = capData.map((team: CapDataTeam) => ({
  teamName: team.team,
  totalCapAllocation: Math.round(team.totalCapAllocations),
  capSpace: Math.round(team.capSpace),
  firstApronSpace: Math.round(team.firstApronSpace),
  secondApronSpace: Math.round(team.SecondApronSpace),
}));

async function fetchTeams() {
  try {
    const url =
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";
    console.log("Fetching teams from:", url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlows/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.status}`);
    }

    const data = await response.json();

    const teams =
      data.sports[0]?.leagues[0]?.teams?.map((teamData: any) => ({
        id: teamData.team.id,
        slug: teamData.team.slug,
        abbreviation: teamData.team.abbreviation,
        displayName: teamData.team.displayName,
        shortDisplayName: teamData.team.shortDisplayName,
        name: teamData.team.name,
        location: teamData.team.location,
        color: teamData.team.color,
        alternateColor: teamData.team.alternateColor,
        isActive: teamData.team.isActive,
        logos: teamData.team.logos,
        record: teamData.team.record,
        venue: teamData.team.venue,
        nickname: teamData.team.nickname,
        links: teamData.team.links,
      })) || [];

    return teams;
  } catch (error) {
    console.error("Error fetching teams:", error);
    throw error;
  }
}

async function fetchTeamRecord(teamId: string) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}`;
    console.log(`Fetching record for team ${teamId}...`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlows/1.0)",
      },
    });

    const data = await response.json();
    const recordItem = data.team?.record?.items?.[0];

    if (!recordItem) {
      return { wins: 41, losses: 41, winPercentage: 0.5, conferenceRank: 15, divisionRank: 5 };
    }

    // Parse stats array into a keyed object
    const statsMap: Record<string, number> = {};
    for (const stat of recordItem.stats || []) {
      statsMap[stat.name] = stat.value;
    }

    return {
      wins: statsMap.wins ?? 41,
      losses: statsMap.losses ?? 41,
      winPercentage: statsMap.winPercent ?? 0.5,
      conferenceRank: statsMap.playoffSeed ?? 15,
      divisionRank: statsMap.divisionRank ?? 5,
    };
  } catch (error) {
    console.error(`Error fetching record for team ${teamId}:`, error);
    return { wins: 41, losses: 41, winPercentage: 0.5, conferenceRank: 15, divisionRank: 5 };
  }
}

async function fetchPlayerStats(espnId: string): Promise<any> {
  try {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlows/1.0)",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const avgCategory = data.categories?.find((c: any) => c.name === "averages");
    if (!avgCategory) return null;

    const labels: string[] = avgCategory.labels || [];
    // Get current season stats (last entry in statistics array)
    const seasons = avgCategory.statistics || [];
    const currentSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;

    if (!currentSeason?.stats) return null;

    const statMap: Record<string, string> = {};
    for (let i = 0; i < labels.length; i++) {
      statMap[labels[i]] = currentSeason.stats[i];
    }

    return {
      points: parseFloat(statMap["PTS"] || "0"),
      rebounds: parseFloat(statMap["REB"] || "0"),
      assists: parseFloat(statMap["AST"] || "0"),
      steals: parseFloat(statMap["STL"] || "0"),
      blocks: parseFloat(statMap["BLK"] || "0"),
      fieldGoalPercentage: parseFloat(statMap["FG%"] || "0"),
      threePointPercentage: parseFloat(statMap["3P%"] || "0"),
      freeThrowPercentage: parseFloat(statMap["FT%"] || "0"),
      minutesPerGame: parseFloat(statMap["MIN"] || "0"),
      gamesPlayed: parseFloat(statMap["GP"] || "0"),
      turnovers: parseFloat(statMap["TO"] || "0"),
      fieldGoalAttempts: parseFloat(statMap["FGA"] || "0"),
      fieldGoalsMade: parseFloat(statMap["FGM"] || "0"),
      threePointAttempts: parseFloat(statMap["3PA"] || "0"),
      threePointMade: parseFloat(statMap["3PM"] || "0"),
      freeThrowAttempts: parseFloat(statMap["FTA"] || "0"),
      freeThrowsMade: parseFloat(statMap["FTM"] || "0"),
    };
  } catch (error) {
    return null;
  }
}

async function fetchTeamRoster(teamId: string) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
    console.log(`Fetching roster for team ${teamId}...`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlows/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch roster for team ${teamId}: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.athletes) {
      console.warn(`No athletes found in roster data for team ${teamId}`);
      return { athletes: [], team: data.team?.displayName || "Unknown" };
    }

    return {
      athletes: data.athletes,
      team: data.team?.displayName || "Unknown",
    };
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error);
    return { athletes: [], team: "Unknown" };
  }
}

async function seedTeams() {
  console.log("🏀 Seeding NBA teams...");

  const espnTeams = await fetchTeams();
  console.log(`Found ${espnTeams.length} teams from ESPN API`);

  const teams = [];

  for (const espnTeam of espnTeams) {
    const division = TEAM_DIVISIONS[espnTeam.id] || "Unknown";
    const conference =
      NBA_DIVISIONS[division as keyof typeof NBA_DIVISIONS] || "Unknown";
    const getSalaryCapData = salaryCapData.find(
      (t: { teamName: string }) => t.teamName === espnTeam.displayName
    );

    const teamData = {
      abbreviation: espnTeam.abbreviation,
      displayName: espnTeam.displayName,
      shortDisplayName: espnTeam.shortDisplayName,
      name: espnTeam.name,
      location: espnTeam.location,
      nickname: espnTeam.nickname,
      color: espnTeam.color,
      alternateColor: espnTeam.alternateColor,
      isActive: espnTeam.isActive,
      logos: espnTeam.logos,
      record: await fetchTeamRecord(espnTeam.id),
      slug: espnTeam.slug,
      conference,
      division,
      totalCapAllocation: getSalaryCapData?.totalCapAllocation || 0,
      capSpace: getSalaryCapData?.capSpace || 0,
      firstApronSpace: getSalaryCapData?.firstApronSpace || 0,
      secondApronSpace: getSalaryCapData?.secondApronSpace || 0,
      links: espnTeam.links,
    };

    const team = await prisma.team.create({
      data: teamData,
    });

    teams.push({ ...team, espnTeamId: espnTeam.id });
    console.log(`✅ ${team.abbreviation} - ${team.name} (ESPN ID: ${espnTeam.id})`);
  }

  console.log(`🎉 Successfully seeded ${teams.length} teams\n`);
  return teams;
}

async function seedPlayers(teams: any[]) {
  console.log("👥 Seeding NBA players...");

  for (const team of teams) {
    const roster: any = await fetchTeamRoster(team.espnTeamId);
    console.log(`Found ${roster.athletes.length} players for ${team.name} (ESPN ID: ${team.espnTeamId})`);

    const findTeam = await prisma.team.findUnique({
      where: {
        slug: team.slug,
      },
    });

    if (!findTeam) {
      console.warn(
        `Could not find team in database for ${team.name} (slug: ${team.slug})`
      );
      continue;
    }

    for (const player of roster.athletes) {
      if (
        player.contract &&
        player.contract.salary !== 0 &&
        player.contract.yearsRemaing !== 0
      ) {
        try {
          // Fetch player stats from ESPN
          const stats = await fetchPlayerStats(player.id.toString());

          const playerData = {
            espnId: player.id.toString(),
            firstName: player.firstName,
            lastName: player.lastName,
            fullName: player.fullName,
            displayName: player.displayName,
            shortName: player.shortName,
            weight: player.weight,
            displayWeight: player.displayWeight,
            height: player.height,
            displayHeight: player.displayHeight,
            age: player.age,
            dateOfBirth: player.dateOfBirth || "1990-01-01T00:00:00Z",
            birthPlace: player.birthPlace || null,
            slug: player.slug,
            headshot: player.headshot || null,
            jersey: player.jersey,
            position: player.position || null,
            injuries: player.injuries || [],
            experience: player.experience || { years: 0 },
            contract: player.contract || null,
            status: player.status || null,
            statistics: stats,
            teamId: findTeam.id,
          };

          await prisma.player.create({
            data: playerData,
          });
          const statsStr = stats ? `${stats.points}ppg/${stats.rebounds}rpg/${stats.assists}apg` : "no stats";
          console.log(`  ✅ ${playerData.displayName} (${statsStr})`);

          // Small delay to avoid hammering ESPN API
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to add player ${player.displayName}:`, error);
        }
      }
    }
  }
}

interface RawDraftPick {
  team: string;
  year: string;
  round: number;
  description: string;
}

interface EnrichedPick {
  year: number;
  round: number;
  originalDescription: string;
  description: string;
  estimatedValue: number;
  isProtected: boolean;
  splitIndex: number; // 0 for non-split or first split, 1, 2... for additional splits
}

async function enrichPicksWithLLM(
  teamName: string,
  record: string,
  picks: RawDraftPick[]
): Promise<EnrichedPick[]> {
  const picksForPrompt = picks.map((p) => ({
    year: parseInt(p.year),
    round: p.round,
    description: p.description,
  }));

  const prompt = `You are an NBA draft pick evaluator. Given the following draft picks owned by the ${teamName} (current record: ${record}), do three things:

1. **Simplify the description** into a short, consistent format. Examples:
   - "Own" → "Own pick"
   - "From Brooklyn (via Phoenix)" → "Via BKN (through PHX)"
   - Complex protection language → summarize the key protection simply, e.g. "Via MIA - top 10 protected through 2027, becomes 2 2nds"
   - Keep it under 80 characters when possible

2. **Estimate a value from 1-100** based on:
   - Round (1st round picks are more valuable than 2nd round)
   - Year (closer years are generally more valuable / more certain)
   - Team quality (bad teams = higher picks = more valuable)
   - Protections (protected picks are less valuable to the receiving team)
   - "Own pick" for a bad team is very valuable (top 5 potential), "Own pick" for a great team is less valuable
   - Swap rights are generally less valuable than outright picks
   - Use the team's current record to inform how good/bad the team is

3. **Detect and split multi-destination picks**: If a single entry describes multiple DISTINCT picks going to DIFFERENT destination teams, output separate entries for each pick. Set "splitIndex" to 0, 1, 2... for each. Give each split entry its own description and value estimate.

   SPLIT these (multiple picks, different destinations):
   - "two most favorable of DEN, OKC and LAC to OKC then other to LAC" → split into 2 entries: one "To OKC (more favorable of DEN/OKC/LAC)", one "To LAC (remaining of DEN/OKC/LAC)"
   - "Most favorable to POR; second most favorable to WAS" → split into 2 entries, one per destination
   - "one to MEM, other to BRK" → split into 2 entries

   DO NOT split these (single pick, conditional ownership):
   - "More favorable of ATL and SAN" → one pick, just conditional on draft position
   - "via BOS to MEM to POR" → one pick, trade chain
   - "Own or swap for HOU" → one pick with swap option
   - "if PHL conveys 1st round pick to OKC in 2026" → conditional, one pick

   Split pick descriptions must NOT start with "Own".

Here are the picks:
${JSON.stringify(picksForPrompt, null, 2)}

Respond with ONLY a JSON array (no markdown, no explanation) where each element has:
- "year": number
- "round": number
- "description": string (simplified)
- "estimatedValue": number (1-100)
- "isProtected": boolean
- "splitIndex": number (0 for non-split picks or the first of a split group, 1 for the second, etc.)`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an NBA analytics assistant. Always respond with valid JSON. Wrap your array in an object with a 'picks' key.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from GPT");

    const parsed = JSON.parse(content);
    const rawResults: any[] = parsed.picks || parsed;

    // The LLM may return more entries than input (due to splits), so we can't
    // index by i to get the original description. Instead, match by year+round.
    const origByYearRound = new Map<string, string>();
    for (const p of picks) {
      origByYearRound.set(`${parseInt(p.year)}-${p.round}`, p.description);
    }

    const enrichedPicks: EnrichedPick[] = rawResults.map((p: any) => ({
      year: p.year,
      round: p.round,
      originalDescription: origByYearRound.get(`${p.year}-${p.round}`) ?? "",
      description: p.description || "",
      estimatedValue: Math.min(100, Math.max(1, p.estimatedValue || 50)),
      isProtected:
        p.isProtected ??
        (origByYearRound.get(`${p.year}-${p.round}`) ?? "").toLowerCase().includes("protected"),
      splitIndex: p.splitIndex ?? 0,
    }));

    return enrichedPicks;
  } catch (error) {
    console.error(`  ⚠️ LLM enrichment failed for ${teamName}, using defaults`);
    console.error(error);
    // Fallback: return picks with default values (no splitting on error)
    return picks.map((p) => ({
      year: parseInt(p.year),
      round: p.round,
      originalDescription: p.description,
      description: p.description,
      estimatedValue: p.round === 1 ? 55 : 25,
      isProtected: p.description.toLowerCase().includes("protected"),
      splitIndex: 0,
    }));
  }
}

async function seedDraftPicks(
  teams: { id: number; name: string; location: string; record: any }[]
) {
  console.log("📝 Seeding draft picks with LLM enrichment...");

  const draftPicksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "seeddata", "nba_draft_picks.json"),
      "utf-8"
    )
  );

  // Create a map of team display names to team DB records
  const teamMap = new Map(
    teams.map((team) => [`${team.location} ${team.name}`, team])
  );

  // Phase 1: Enrich all picks with LLM (no DB writes yet)
  console.log("\n📡 Phase 1: Enriching picks with LLM...");
  const allPicksToInsert: {
    teamId: number;
    teamName: string;
    pick: EnrichedPick;
  }[] = [];

  for (const [teamName, picks] of Object.entries(draftPicksData)) {
    const team = teamMap.get(teamName);
    if (!team) {
      console.warn(`  ⚠️ Team not found: ${teamName}`);
      continue;
    }

    const rawPicks = picks as RawDraftPick[];
    if (rawPicks.length === 0) continue;

    const record =
      typeof team.record === "string" ? team.record : JSON.stringify(team.record);

    console.log(`  🏀 ${teamName} (${record}) - ${rawPicks.length} picks`);

    const enrichedPicks = await enrichPicksWithLLM(teamName, record, rawPicks);

    for (const pick of enrichedPicks) {
      allPicksToInsert.push({ teamId: team.id, teamName, pick });
    }
  }

  console.log(`\n✅ Enriched ${allPicksToInsert.length} picks total`);

  // Phase 2: Insert all picks into DB in quick succession
  console.log("\n💾 Phase 2: Writing picks to database...");
  const createdPicks = new Set<string>();
  let totalPicks = 0;

  for (const { teamId, teamName, pick } of allPicksToInsert) {
    const pickKey = `${pick.year}-${pick.round}-${teamId}-${pick.splitIndex}`;

    if (createdPicks.has(pickKey)) {
      continue;
    }

    try {
      await prisma.draftPick.create({
        data: {
          year: pick.year,
          round: pick.round,
          sequence: pick.splitIndex,
          teamId,
          isSwap: false,
          isProtected: pick.isProtected,
          description: pick.description,
          estimatedValue: pick.estimatedValue,
        },
      });

      createdPicks.add(pickKey);
      totalPicks++;
      const splitTag = pick.splitIndex > 0 ? ` [split #${pick.splitIndex}]` : "";
      console.log(
        `  ✅ ${teamName}: ${pick.year} R${pick.round}${splitTag} (value: ${pick.estimatedValue}) - ${pick.description}`
      );
    } catch (error) {
      console.error(
        `  ❌ Failed to insert ${teamName}: ${pick.year} R${pick.round}:`,
        error
      );
    }
  }

  console.log(`\n🎉 Seeded ${totalPicks} draft picks with estimated values!`);
}

async function main() {
  console.log("🚀 Starting NBA database seed...\n");

  try {
    // Clear existing data
    console.log("🧹 Cleaning existing data...");
    await prisma.tradeAsset.deleteMany();
    await prisma.tradeTeam.deleteMany();
    await prisma.tradeVote.deleteMany();
    await prisma.tradeComment.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.player.deleteMany();
    await prisma.draftPick.deleteMany();
    await prisma.team.deleteMany();
    console.log("✅ Cleared existing data\n");

    // Seed teams
    const teams = await seedTeams();

    // Seed players
    await seedPlayers(teams);

    // Seed draft picks
    await seedDraftPicks(teams);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`- Teams: ${teams.length}`);
    const playerCount = await prisma.player.count();
    const pickCount = await prisma.draftPick.count();
    console.log(`- Players: ${playerCount}`);
    console.log(`- Draft Picks: ${pickCount}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
