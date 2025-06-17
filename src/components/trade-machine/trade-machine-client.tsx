"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { TeamSelectDropdown } from "../trade-machine/team-select-dropdown";
import { TeamCard } from "../trade-machine/team-card";
import { Button } from "~/components/ui/button";
import { LightbulbIcon, UsersIcon, PackageIcon } from "lucide-react"; // Added PackageIcon, PlusIcon, and Loader2
import { Navbar } from "~/components/layout/navbar";
import type { Team } from "~/types";
import { toast } from "sonner";
import { useState } from "react";
import Image from "next/image";

const MAX_TEAMS = 5;

interface SelectedAsset {
  id: string;
  type: "player" | "pick";
  teamId: number;
}

export default function TradeMachineClient({ nbaTeams }: { nbaTeams: Team[] }) {
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");

  const handleTeamSelect = async (team: Team) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/nba/team/${team.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch team data");
      }
      const responseData = await response.json();
      const teamWithRoster = responseData.data;

      setSelectedTeams((prev) => {
        const newTeams = [...prev, teamWithRoster];
        setTimeout(() => setActiveTab(team.id.toString()), 0);
        return newTeams;
      });
      setSelectedTeamIds((prev) => [...prev, team.id]);
      setShowTeamSelector(false);
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast.error("Failed to load team data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTeam = (teamId: number) => {
    const isFirstTeamAndMultipleTeams =
      selectedTeamIds.length > 1 && selectedTeamIds[0] === teamId;
    setSelectedTeams((prev) => prev.filter((team) => team.id !== teamId));
    setSelectedTeamIds((prev) => prev.filter((id) => id !== teamId));
    setSelectedAssets((prev) =>
      prev.filter((asset) => {
        const team = selectedTeams.find((t) => t.id === teamId);
        if (!team) return true;

        if (asset.type === "player") {
          return !team.players?.some((p) => p.id.toString() === asset.id);
        } else {
          return !team.draftPicks?.some((p) => p.id.toString() === asset.id);
        }
      })
    );
    const getNextTabValue = !isFirstTeamAndMultipleTeams
      ? selectedTeams?.[0]?.id.toString()
      : selectedTeamIds?.[1]?.toString();

    setTimeout(() => setActiveTab(getNextTabValue || ""), 0);
  };

  const handleChangeTeam = async (oldTeamId: number, newTeam: Team) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/nba/team/${newTeam.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch team data");
      }
      const responseData = await response.json();
      const teamWithRoster = responseData.data;

      setSelectedTeams((prev) =>
        prev.map((t) => (t.id === oldTeamId ? (teamWithRoster as Team) : t))
      );
      setSelectedTeamIds((prev) =>
        prev.map((id) => (id === oldTeamId ? newTeam.id : id))
      );
      setSelectedAssets((prev) => prev.filter((a) => a.teamId !== oldTeamId));
      setActiveTab(newTeam.id.toString());
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast.error("Failed to load team data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetSelect = (
    assetId: string,
    assetType: "player" | "pick",
    teamId: number
  ) => {
    setSelectedAssets((prev) => {
      const existingAsset = prev.find(
        (a) => a.id === assetId && a.type === assetType
      );
      if (existingAsset) {
        return prev.filter((a) => !(a.id === assetId && a.type === assetType));
      } else {
        return [...prev, { id: assetId, type: assetType, teamId }];
      }
    });
  };

  const isTradeButtonActive = selectedAssets.length > 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-grow p-4 md:p-6 lg:p-8">
        <div className="my-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <TeamSelectDropdown
            allTeams={nbaTeams}
            selectedTeamIds={selectedTeamIds}
            onTeamSelect={handleTeamSelect}
            maxTeamsReached={selectedTeams.length >= MAX_TEAMS}
            isLoading={isLoading}
          />
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            {selectedAssets.length > 0 && (
              <div className="flex items-center text-sm text-muted-foreground border border-border bg-muted/30 px-3 py-2 rounded-md w-full sm:w-auto">
                <PackageIcon
                  className="mr-2 h-4 w-4 text-primary"
                  strokeWidth={1.5}
                />
                <span>
                  {selectedAssets.length} Asset
                  {selectedAssets.length === 1 ? "" : "s"} Selected
                </span>
              </div>
            )}
            <Button
              disabled={!isTradeButtonActive}
              onClick={() =>
                alert("Generate Trade Clicked! AI magic incoming...")
              }
              className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
                         disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
                         transition-all duration-150 ease-in-out"
            >
              <LightbulbIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
              Generate Trade
            </Button>
          </div>
        </div>

        <>
          {selectedTeams.length > 0 ? (
            <>
              {/* Mobile Tabs - Only show when 2 or more teams */}
              {selectedTeams.length >= 2 && (
                <div className="md:hidden mb-4">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    defaultValue={selectedTeams[0]?.id.toString()}
                    className="w-full "
                  >
                    <TabsList
                      className="w-full grid h-16 "
                      style={{
                        gridTemplateColumns: `repeat(${selectedTeams.length}, 1fr)`,
                      }}
                    >
                      {selectedTeams.map((team) => (
                        <TabsTrigger
                          key={team.id}
                          value={team.id.toString()}
                          className="p-2 flex items-center justify-center"
                        >
                          {team.logos[0] ? (
                            <Image
                              src={team.logos[0].href}
                              alt={team.logos[0].alt}
                              width={32}
                              height={32}
                              className="object-contain"
                            />
                          ) : (
                            <span className="text-xs">{team.displayName}</span>
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {selectedTeams.map((team) => (
                      <TabsContent key={team.id} value={team.id.toString()}>
                        <TeamCard
                          team={team}
                          allTeams={nbaTeams}
                          selectedTeamIdsInMachine={selectedTeamIds}
                          onRemoveTeam={handleRemoveTeam}
                          selectedAssets={selectedAssets.filter(
                            (sa) => sa.teamId === team.id
                          )}
                          onAssetSelect={handleAssetSelect}
                          setSelectedTeams={setSelectedTeams}
                          setSelectedTeamIds={setSelectedTeamIds}
                          setSelectedAssets={setSelectedAssets}
                          setActiveTab={setActiveTab}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}

              {/* Single Team View - Mobile */}
              {selectedTeams.length === 1 && selectedTeams[0] && (
                <div className="md:hidden">
                  <TeamCard
                    team={selectedTeams[0]}
                    allTeams={nbaTeams}
                    selectedTeamIdsInMachine={selectedTeamIds}
                    onRemoveTeam={handleRemoveTeam}
                    selectedAssets={selectedAssets.filter(
                      (sa) => sa.teamId === selectedTeams[0]?.id
                    )}
                    onAssetSelect={handleAssetSelect}
                    setSelectedTeams={setSelectedTeams}
                    setSelectedTeamIds={setSelectedTeamIds}
                    setSelectedAssets={setSelectedAssets}
                    setActiveTab={setActiveTab}
                  />
                </div>
              )}

              {/* Desktop Grid */}
              <div
                className="hidden md:grid gap-4 md:gap-6"
                style={{
                  gridTemplateColumns:
                    selectedTeams.length === 1
                      ? "repeat(2, 1fr)"
                      : selectedTeams.length === 2
                      ? "repeat(2, 1fr)"
                      : selectedTeams.length === 3
                      ? "repeat(3, 1fr)"
                      : selectedTeams.length === 4
                      ? "repeat(4, 1fr)"
                      : "repeat(5, 1fr)",
                }}
              >
                {selectedTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    allTeams={nbaTeams}
                    selectedTeamIdsInMachine={selectedTeamIds}
                    onRemoveTeam={handleRemoveTeam}
                    selectedAssets={selectedAssets.filter(
                      (sa) => sa.teamId === team.id
                    )}
                    onAssetSelect={handleAssetSelect}
                    setSelectedTeams={setSelectedTeams}
                    setSelectedTeamIds={setSelectedTeamIds}
                    setSelectedAssets={setSelectedAssets}
                    setActiveTab={setActiveTab}
                  />
                ))}
                {selectedTeams.length === 1 && (
                  <div className="flex flex-col border rounded-lg overflow-hidden">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted rounded-lg bg-muted/5 m-4">
                      <UsersIcon
                        className="w-12 h-12 text-muted-foreground mb-3"
                        strokeWidth={1.5}
                      />
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Add Another Team
                      </h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Generate a trade by selecting a player/pick or expand
                        your trade by adding more teams
                      </p>
                      <TeamSelectDropdown
                        allTeams={nbaTeams}
                        selectedTeamIds={selectedTeamIds}
                        onTeamSelect={handleTeamSelect}
                        maxTeamsReached={selectedTeams.length >= MAX_TEAMS}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center p-8 border rounded-lg bg-muted/50">
              <LightbulbIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Teams Selected</h3>
              <p className="text-muted-foreground mb-4">
                Add teams to start building your trade
              </p>
            </div>
          )}
        </>

        {showTeamSelector && (
          <TeamSelectDropdown
            allTeams={nbaTeams.filter(
              (team) => !selectedTeamIds.includes(team.id)
            )}
            selectedTeamIds={selectedTeamIds}
            onTeamSelect={handleTeamSelect}
            maxTeamsReached={selectedTeams.length >= MAX_TEAMS}
          />
        )}
      </div>
    </div>
  );
}
