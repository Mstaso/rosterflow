"use client";

import { useState } from "react";
import {
  useTeamRoster,
  useNBATeams,
  useGenerateTrades,
  useApi,
} from "~/hooks/useApi";

// Example 1: Using the team roster hook
export function TeamRosterExample() {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>("1");

  const {
    data: roster,
    loading,
    error,
    refetch,
  } = useTeamRoster(selectedTeamId);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Team Roster Hook Example</h2>

      <div className="mb-4">
        <label className="mb-2 block">Team ID:</label>
        <input
          type="text"
          value={selectedTeamId || ""}
          onChange={(e) => setSelectedTeamId(e.target.value || null)}
          className="rounded border p-2"
          placeholder="Enter team ID"
        />
        <button
          onClick={() => refetch()}
          className="ml-2 rounded bg-blue-500 px-4 py-2 text-white"
        >
          Refetch
        </button>
      </div>

      {loading && <p>Loading roster...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {roster && (
        <div>
          <h3 className="font-bold">Players ({roster.roster.length}):</h3>
          <ul className="list-disc pl-5">
            {roster.roster.slice(0, 5).map((player) => (
              <li key={player.id}>
                {player.displayName} - {player.position?.abbreviation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Example 2: Using the NBA teams hook
export function NBATeamsExample() {
  const { data: teams, loading, error, refetch } = useNBATeams();

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">NBA Teams Hook Example</h2>

      <button
        onClick={() => refetch()}
        className="mb-4 rounded bg-green-500 px-4 py-2 text-white"
      >
        Refetch Teams
      </button>

      {loading && <p>Loading teams...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {teams && (
        <div>
          <h3 className="font-bold">NBA Teams ({teams.length}):</h3>
          <div className="grid grid-cols-3 gap-2">
            {teams.slice(0, 9).map((team) => (
              <div key={team.id} className="rounded border p-2">
                {team.displayName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Example 3: Using the trade generation hook
export function TradeGenerationExample() {
  const { data: trades, loading, error, generateTrades } = useGenerateTrades();

  const handleGenerateTrades = async () => {
    try {
      await generateTrades({
        assets: [
          {
            id: "player1",
            type: "player",
            fromTeam: "1",
            toTeam: "2",
            data: { name: "Example Player", salary: 5000000 },
          },
        ],
        teams: ["1", "2"],
        destinationPreferences: { "1": ["2"] },
        sport: "NBA",
      });
    } catch (err) {
      console.error("Failed to generate trades:", err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Trade Generation Hook Example</h2>

      <button
        onClick={handleGenerateTrades}
        disabled={loading}
        className="mb-4 rounded bg-purple-500 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Trades"}
      </button>

      {error && <p className="text-red-500">Error: {error}</p>}
      {trades && (
        <div>
          <h3 className="font-bold">Generated Trades:</h3>
          <pre className="rounded bg-gray-100 p-2 text-sm">
            {JSON.stringify(trades, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Example 4: Using the generic useApi hook
export function GenericApiExample() {
  const [url, setUrl] = useState<string | null>("/api/espn/nba/teams");

  const { data, loading, error, refetch, clearCache } = useApi(url, {
    immediate: false, // Don't fetch immediately
    cache: true,
    cacheTime: 2 * 60 * 1000, // 2 minutes cache
  });

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Generic API Hook Example</h2>

      <div className="mb-4">
        <label className="mb-2 block">API URL:</label>
        <input
          type="text"
          value={url || ""}
          onChange={(e) => setUrl(e.target.value || null)}
          className="w-full rounded border p-2"
          placeholder="Enter API URL"
        />
      </div>

      <div className="mb-4 space-x-2">
        <button
          onClick={() => refetch()}
          disabled={!url}
          className="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
        >
          Fetch Data
        </button>
        <button
          onClick={() => clearCache()}
          className="rounded bg-red-500 px-4 py-2 text-white"
        >
          Clear Cache
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {data && (
        <div>
          <h3 className="font-bold">Response Data:</h3>
          <pre className="max-h-64 overflow-auto rounded bg-gray-100 p-2 text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Combined example component
export default function ApiHooksExamples() {
  return (
    <div className="space-y-8">
      <h1 className="text-center text-2xl font-bold">API Hooks Examples</h1>
      <TeamRosterExample />
      <NBATeamsExample />
      <TradeGenerationExample />
      <GenericApiExample />
    </div>
  );
}
