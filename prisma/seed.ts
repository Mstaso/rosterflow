import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

// NBA Conference and Division mappings
const NBA_DIVISIONS = {
  Atlantic: "Eastern",
  Central: "Eastern",
  Southeast: "Eastern",
  Northwest: "Western",
  Pacific: "Western",
  Southwest: "Western",
};

// ESPN Team ID to Division mapping (you may need to adjust these)
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

async function fetchTeams() {
  try {
    const url =
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams";
    console.log("Fetching teams from:", url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to include only essential team info
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

    // return [
    //   {
    //     id: data.sports[0]?.leagues[0]?.teams[0].team.id,
    //     abbreviation: data.sports[0]?.leagues[0]?.teams[0].team.abbreviation,
    //     displayName: data.sports[0]?.leagues[0]?.teams[0].team.displayName,
    //     shortDisplayName:
    //       data.sports[0]?.leagues[0]?.teams[0].team.shortDisplayName,
    //     name: data.sports[0]?.leagues[0]?.teams[0].team.name,
    //     location: data.sports[0]?.leagues[0]?.teams[0].team.location,
    //     color: data.sports[0]?.leagues[0]?.teams[0].team.color,
    //     alternateColor:
    //       data.sports[0]?.leagues[0]?.teams[0].team.alternateColor,
    //     isActive: data.sports[0]?.leagues[0]?.teams[0].team.isActive,
    //     logos: data.sports[0]?.leagues[0]?.teams[0].team.logos,
    //     record: data.sports[0]?.leagues[0]?.teams[0].team.record,
    //     slug: data.sports[0]?.leagues[0]?.teams[0].team.slug,
    //     nickname: data.sports[0]?.leagues[0]?.teams[0].team.nickname,
    //     links: data.sports[0]?.leagues[0]?.teams[0].team.links,
    //   },
    // ];
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
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    const data = await response.json();
    return data.team?.record?.items[0]?.summary
      ? data.team?.record?.items[0]?.summary
      : "41-41";
  } catch (error) {
    console.error(`Error fetching record for team ${teamId}:`, error);
    return []; // Return empty array instead of throwing
  }
}

async function fetchTeamRoster(teamId: string) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
    console.log(`Fetching roster for team ${teamId}...`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch roster for team ${teamId}: ${response.status}`
      );
    }

    const data = await response.json();
    return data.athletes || [];
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error);
    return []; // Return empty array instead of throwing
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
      (t) => t.teamName === espnTeam.displayName
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

    console.log("Creating team:", teamData);

    const team = await prisma.team.create({
      data: teamData,
    });

    teams.push(team);
    console.log(`✅ ${team.abbreviation} - ${team.name}`);
  }

  console.log(`🎉 Successfully seeded ${teams.length} teams\n`);
  return teams;
}

async function seedPlayers(teams: any[]) {
  console.log("👥 Seeding NBA players...");

  for (const team of teams) {
    const espnTeamId = teamIdMap[team.slug];
    if (!espnTeamId) {
      console.warn(
        `No ESPN team ID found for ${team.name} (slug: ${team.slug})`
      );
      continue;
    }

    const roster = await fetchTeamRoster(espnTeamId);
    console.log(`Found ${roster.length} players for ${team.name}`);

    for (const player of roster) {
      if (
        player.contract &&
        player.contract.salary !== 0 &&
        player.contract.yearsRemaing !== 0
      ) {
        try {
          const playerData = {
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
            dateOfBirth: player.dateOfBirth || "1990-01-01T00:00:00Z", // Keep as string
            birthPlace: player.birthPlace || null,
            slug: player.slug,
            headshot: player.headshot || null,
            jersey: player.jersey,
            position: player.position || null,
            injuries: player.injuries || [],
            experience: player.experience || { years: 0 },
            contract: player.contract || null,
            status: player.status || null,
            teamId: team.id,
          };

          console.log(`Creating player: ${playerData.displayName}`);
          await prisma.player.create({
            data: playerData,
          });
          console.log(`Successfully created player: ${playerData.displayName}`);
        } catch (error) {
          console.error(`Failed to add player ${player.displayName}:`, error);
        }
      }
    }
  }
}

async function seedDraftPicks(
  teams: { id: number; name: string; location: string }[]
) {
  console.log("Seeding draft picks...");

  // Read the draft picks data
  const draftPicksData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "seeddata", "nba_draft_picks.json"),
      "utf-8"
    )
  );

  // Create a map of team names to team IDs
  const teamMap = new Map(
    teams.map((team) => [`${team.location} ${team.name}`, team.id])
  );

  // Track created picks for deduplication
  const createdPicks = new Set<string>();

  // Process each team's picks
  for (const [teamName, picks] of Object.entries(draftPicksData)) {
    const teamId = teamMap.get(teamName);
    if (!teamId) {
      console.warn(`Team not found: ${teamName}`);
      continue;
    }

    for (const pick of picks as any[]) {
      // Create a unique key for this pick
      const pickKey = `${pick.year}-${pick.round}-${teamId}`;

      // Skip if we've already created this pick
      if (createdPicks.has(pickKey)) {
        continue;
      }

      // Create the draft pick
      await prisma.draftPick.create({
        data: {
          year: parseInt(pick.year),
          round: pick.round,
          teamId: teamId,
          isSwap: pick.swap,
          isProtected:
            !pick.swap && pick.description.toLowerCase().includes("protected"),
          description: pick.description,
        },
      });

      createdPicks.add(pickKey);
    }
  }

  console.log("Draft picks seeded successfully!");
}

async function main() {
  console.log("🚀 Starting NBA database seed...\n");

  try {
    // Clear existing data (optional - remove if you want to keep existing data)
    console.log("🧹 Cleaning existing data...");
    await prisma.tradeAsset.deleteMany();
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

    console.log("🎉 Database seeding completed successfully!");
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
const salaryCapData = [
  {
    teamName: "Atlanta Hawks",
    totalCapAllocation: 253589875,
    capSpace: -98942875,
    firstApronSpace: 48995201,
    secondApronSpace: 60874201,
  },
  {
    teamName: "Boston Celtics",
    totalCapAllocation: 261900828,
    capSpace: -107253828,
    firstApronSpace: 31838873,
    secondApronSpace: 19959873,
  },
  {
    teamName: "Brooklyn Nets",
    totalCapAllocation: 191046962,
    capSpace: -36399962,
    firstApronSpace: 127556060,
    secondApronSpace: 139435060,
  },
  {
    teamName: "Charlotte Hornets",
    totalCapAllocation: 183704730,
    capSpace: -29057730,
    firstApronSpace: 44716311,
    secondApronSpace: 56595311,
  },
  {
    teamName: "Chicago Bulls",
    totalCapAllocation: 191320405,
    capSpace: -36673405,
    firstApronSpace: 59766333,
    secondApronSpace: 71645333,
  },
  {
    teamName: "Cleveland Cavaliers",
    totalCapAllocation: 242487583,
    capSpace: -87840583,
    firstApronSpace: 24737272,
    secondApronSpace: 12858272,
  },
  {
    teamName: "Dallas Mavericks",
    totalCapAllocation: 229413241,
    capSpace: -74766241,
    firstApronSpace: 819667,
    secondApronSpace: 12698667,
  },
  {
    teamName: "Denver Nuggets",
    totalCapAllocation: 221452464,
    capSpace: -66805464,
    firstApronSpace: 4734856,
    secondApronSpace: 7144144,
  },
  {
    teamName: "Detroit Pistons",
    totalCapAllocation: 192816729,
    capSpace: -38169729,
    firstApronSpace: 59745378,
    secondApronSpace: 71624378,
  },
  {
    teamName: "Golden State Warriors",
    totalCapAllocation: 265730167,
    capSpace: -111083167,
    firstApronSpace: 25013673,
    secondApronSpace: 36892673,
  },
  {
    teamName: "Houston Rockets",
    totalCapAllocation: 253829562,
    capSpace: -99182562,
    firstApronSpace: 4624460,
    secondApronSpace: 16503460,
  },
  {
    teamName: "Indiana Pacers",
    totalCapAllocation: 226390359,
    capSpace: -71743359,
    firstApronSpace: 27482910,
    secondApronSpace: 39361910,
  },
  {
    teamName: "LA Clippers",
    totalCapAllocation: 194043188,
    capSpace: -39396188,
    firstApronSpace: 23115134,
    secondApronSpace: 34994134,
  },
  {
    teamName: "Los Angeles Lakers",
    totalCapAllocation: 214451192,
    capSpace: -59804192,
    firstApronSpace: 4357330,
    secondApronSpace: 16236330,
  },
  {
    teamName: "Memphis Grizzlies",
    totalCapAllocation: 196075648,
    capSpace: -41428648,
    firstApronSpace: 58354751,
    secondApronSpace: 70233751,
  },
  {
    teamName: "Miami Heat",
    totalCapAllocation: 217087890,
    capSpace: -62440890,
    firstApronSpace: 14948490,
    secondApronSpace: 26827490,
  },
  {
    teamName: "Milwaukee Bucks",
    totalCapAllocation: 227849105,
    capSpace: -73202105,
    firstApronSpace: 28166019,
    secondApronSpace: 40045019,
  },
  {
    teamName: "Minnesota Timberwolves",
    totalCapAllocation: 247749456,
    capSpace: -9310245,
    firstApronSpace: 925404,
    secondApronSpace: 12804404,
  },
  {
    teamName: "New Orleans Pelicans",
    totalCapAllocation: 236882592,
    capSpace: -82235592,
    firstApronSpace: 18373158,
    secondApronSpace: 30252158,
  },
  {
    teamName: "New York Knicks",
    totalCapAllocation: 230526428,
    capSpace: -75879428,
    firstApronSpace: 3833184,
    secondApronSpace: 8045816,
  },
  {
    teamName: "Oklahoma City Thunder",
    totalCapAllocation: 192627442,
    capSpace: -37980442,
    firstApronSpace: 16733201,
    secondApronSpace: 28612201,
  },
  {
    teamName: "Orlando Magic",
    totalCapAllocation: 210870199,
    capSpace: -56223199,
    firstApronSpace: 3421531,
    secondApronSpace: 8457469,
  },
  {
    teamName: "Philadelphia 76ers",
    totalCapAllocation: 207994153,
    capSpace: -53347153,
    firstApronSpace: 18601269,
    secondApronSpace: 30480269,
  },
  {
    teamName: "Phoenix Suns",
    totalCapAllocation: 257172509,
    capSpace: -102525509,
    firstApronSpace: -23287471,
    secondApronSpace: -11408471,
  },
  {
    teamName: "Portland Trail Blazers",
    totalCapAllocation: 196218206,
    capSpace: -41571206,
    firstApronSpace: 23453698,
    secondApronSpace: 35332698,
  },
  {
    teamName: "Sacramento Kings",
    totalCapAllocation: 204895175,
    capSpace: -50248175,
    firstApronSpace: 25696269,
    secondApronSpace: 37575269,
  },
  {
    teamName: "San Antonio Spurs",
    totalCapAllocation: 191645048,
    capSpace: -36998048,
    firstApronSpace: 48927388,
    secondApronSpace: 60806388,
  },
  {
    teamName: "Toronto Raptors",
    totalCapAllocation: 218967368,
    capSpace: -64320368,
    firstApronSpace: 7776625,
    secondApronSpace: 19655625,
  },
  {
    teamName: "Utah Jazz",
    totalCapAllocation: 169163676,
    capSpace: -14516676,
    firstApronSpace: 42652377,
    secondApronSpace: 54531377,
  },
  {
    teamName: "Washington Wizards",
    totalCapAllocation: 251116498,
    capSpace: -96469498,
    firstApronSpace: 31598088,
    secondApronSpace: 43477088,
  },
];

const teamIdMap: Record<string, string> = {
  "atlanta-hawks": "1",
  "boston-celtics": "2",
  "brooklyn-nets": "3",
  "charlotte-hornets": "4",
  "chicago-bulls": "5",
  "cleveland-cavaliers": "6",
  "dallas-mavericks": "7",
  "denver-nuggets": "8",
  "detroit-pistons": "9",
  "golden-state-warriors": "10",
  "houston-rockets": "11",
  "indiana-pacers": "12",
  "la-clippers": "13",
  "los-angeles-lakers": "14",
  "memphis-grizzlies": "15",
  "miami-heat": "16",
  "milwaukee-bucks": "17",
  "minnesota-timberwolves": "18",
  "new-orleans-pelicans": "19",
  "new-york-knicks": "20",
  "oklahoma-city-thunder": "21",
  "orlando-magic": "22",
  "philadelphia-76ers": "23",
  "phoenix-suns": "24",
  "portland-trail-blazers": "25",
  "sacramento-kings": "26",
  "san-antonio-spurs": "27",
  "toronto-raptors": "28",
  "utah-jazz": "29",
  "washington-wizards": "30",
};
