# NBA API Integration Documentation

## Overview

This project integrates with ESPN's undocumented API to fetch NBA team and player data. **No API key or secret key is required** for accessing public data from ESPN.

## Important Notes

- ESPN's API is **unofficial and undocumented**
- These endpoints are reverse-engineered from ESPN's website
- No authentication is required for public data
- The API may change without notice
- Implement proper error handling and caching
- **Contract/salary information is NOT available through ESPN's API**

## Available Endpoints

### 1. NBA Teams

#### Get All NBA Teams

```
GET /api/espn/nba/teams?season=2024
```

**Parameters:**

- `season` (optional): Year (default: `2024`)

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "abbreviation": "ATL",
      "displayName": "Atlanta Hawks",
      "shortDisplayName": "Hawks",
      "location": "Atlanta",
      "name": "Hawks",
      "color": "e03a3e",
      "alternateColor": "c4d600",
      "logos": [
        {
          "href": "https://a.espncdn.com/i/teamlogos/nba/500/atl.png",
          "width": 500,
          "height": 500
        }
      ],
      "record": {
        "items": [
          {
            "description": "Overall Record",
            "type": "total",
            "summary": "15-20"
          }
        ]
      }
    }
  ],
  "total": 30,
  "season": "2024"
}
```

### 2. Team Roster

#### Get Team Roster

```
GET /api/espn/nba/team/[teamId]/roster?season=2024
```

**Parameters:**

- `teamId`: NBA team ID (see team IDs below)
- `season` (optional): Year (default: `2024`)

**Example Response:**

```json
{
  "success": true,
  "data": {
    "team": {
      "id": "1",
      "displayName": "Atlanta Hawks",
      "abbreviation": "ATL"
    },
    "roster": [
      {
        "id": "3136776",
        "firstName": "Trae",
        "lastName": "Young",
        "fullName": "Trae Young",
        "jersey": "11",
        "position": {
          "abbreviation": "PG",
          "displayName": "Point Guard"
        },
        "age": 25,
        "height": 73,
        "displayHeight": "6'1\"",
        "weight": 180,
        "displayWeight": "180 lbs",
        "experience": {
          "years": 6
        },
        "college": {
          "name": "Oklahoma"
        },
        "headshot": {
          "href": "https://a.espncdn.com/i/headshots/nba/players/full/4278073.png"
        }
      }
    ],
    "rosterCount": 15,
    "season": "2024"
  }
}
```

## NBA Team IDs Reference

| Team | ID  | Team | ID  |
| ---- | --- | ---- | --- |
| ATL  | 1   | MIA  | 14  |
| BOS  | 2   | MIL  | 15  |
| BKN  | 17  | MIN  | 16  |
| CHA  | 30  | NOP  | 3   |
| CHI  | 4   | NYK  | 18  |
| CLE  | 5   | OKC  | 25  |
| DAL  | 6   | ORL  | 19  |
| DEN  | 7   | PHI  | 20  |
| DET  | 8   | PHX  | 21  |
| GSW  | 9   | POR  | 22  |
| HOU  | 10  | SAC  | 23  |
| IND  | 11  | SAS  | 24  |
| LAC  | 12  | TOR  | 28  |
| LAL  | 13  | UTA  | 26  |
| MEM  | 29  | WAS  | 27  |

## Usage Examples

### Client-side with fetch

```javascript
// Fetch all NBA teams
const fetchNBATeams = async () => {
  try {
    const response = await fetch("/api/espn/nba/teams");
    const data = await response.json();

    if (data.success) {
      console.log("NBA Teams:", data.data);
    }
  } catch (error) {
    console.error("Error fetching NBA teams:", error);
  }
};

// Fetch Lakers roster
const fetchLakersRoster = async () => {
  try {
    const response = await fetch("/api/espn/nba/team/13/roster");
    const data = await response.json();

    if (data.success) {
      console.log("Lakers Roster:", data.data.roster);
    }
  } catch (error) {
    console.error("Error fetching Lakers roster:", error);
  }
};
```

### Server-side with the utility library

```typescript
import { NBATeam, NBATeamRoster, APIResponse } from "@/lib/nba-types";

// Use the API endpoints in your components
const getTeams = async (): Promise<APIResponse<NBATeam[]>> => {
  const response = await fetch("/api/espn/nba/teams");
  return response.json();
};

const getTeamRoster = async (
  teamId: string,
): Promise<APIResponse<NBATeamRoster>> => {
  const response = await fetch(`/api/espn/nba/team/${teamId}/roster`);
  return response.json();
};
```

## Contract/Salary Information

**Important:** ESPN's API does **NOT** provide contract or salary information for NBA players. For this type of data, you would need to use:

1. **Paid APIs:**

   - SportsRadar (comprehensive but expensive)
   - Sports Data IO (good coverage, various pricing tiers)
   - Rapid API sports providers

2. **Alternative Sources:**

   - Spotrac.com (web scraping - check their terms)
   - Basketball Reference (limited contract data)
   - HoopsHype salary database

3. **Free but Limited Options:**
   - NBA.com official stats (no salary data)
   - Basketball Reference API (limited)

## Error Handling

Always implement proper error handling:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
}
```

## Rate Limiting

ESPN's API is unofficial, so there are no documented rate limits. However:

- Implement caching for data that doesn't change frequently
- Don't make excessive requests
- Consider implementing exponential backoff for failures
- Use the data responsibly

## Data Freshness

- **Teams data**: Changes rarely, cache for hours/days
- **Roster data**: Can change during season, cache for 30-60 minutes
- **Player stats**: Updates frequently during games, cache for 5-15 minutes

## Next Steps

1. **Test the endpoints** by making requests to `/api/espn/nba/teams`
2. **Implement caching** for better performance
3. **Add error boundaries** in your React components
4. **Consider upgrading** to a paid API if you need salary/contract data
5. **Monitor the endpoints** for any changes in ESPN's API structure
