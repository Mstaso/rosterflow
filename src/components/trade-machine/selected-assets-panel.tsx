"use client";

import { Button } from "~/components/ui/button";
import {
  PackageIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Trash2Icon,
  ArrowRightIcon,
} from "lucide-react";
import Image from "next/image";
import type { SelectedAsset, Team } from "~/types";

interface SelectedAssetsPanelProps {
  selectedAssets: SelectedAsset[];
  selectedTeams: Team[];
  onRemoveAsset: (assetId: number, assetType: "player" | "pick") => void;
  onClearAll?: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Button trigger component
export function SelectedAssetsTrigger({
  selectedAssets,
  isOpen,
  onToggle,
}: Pick<SelectedAssetsPanelProps, "selectedAssets" | "isOpen" | "onToggle">) {
  if (selectedAssets.length === 0) return null;

  return (
    <Button
      variant="outline"
      className="w-full sm:w-auto flex items-center justify-center gap-2 border-border bg-muted/30 hover:bg-muted/50"
      onClick={onToggle}
    >
      <PackageIcon className="h-4 w-4 text-indigoMain" strokeWidth={1.5} />
      <span>
        {selectedAssets.length} Asset
        {selectedAssets.length === 1 ? "" : "s"} Selected
      </span>
      {isOpen ? (
        <ChevronUpIcon className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <ChevronDownIcon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </Button>
  );
}

// Content component to be rendered separately
export function SelectedAssetsContent({
  selectedAssets,
  selectedTeams,
  onRemoveAsset,
  onClearAll,
  isOpen,
}: Omit<SelectedAssetsPanelProps, "onToggle">) {
  if (!isOpen || selectedAssets.length === 0) return null;

  // Get asset details from teams
  const getAssetDetails = (asset: SelectedAsset) => {
    const fromTeam = selectedTeams.find((t) => t.id === asset.teamId);
    const toTeam = asset.targetTeamId
      ? selectedTeams.find((t) => t.id === asset.targetTeamId)
      : null;

    if (asset.type === "player") {
      const player = fromTeam?.players?.find((p) => p.id === asset.id);
      return { fromTeam, toTeam, player, pick: null };
    } else {
      const pick = fromTeam?.draftPicks?.find((p) => p.id === asset.id);
      return { fromTeam, toTeam, player: null, pick };
    }
  };

  // Group assets by from team
  const assetsByTeam = selectedAssets.reduce((acc, asset) => {
    const teamId = asset.teamId;
    if (!acc[teamId]) {
      acc[teamId] = [];
    }
    acc[teamId].push(asset);
    return acc;
  }, {} as Record<number, SelectedAsset[]>);

  return (
    <div className="border border-border rounded-lg bg-muted/20 p-4 space-y-4">
      {/* Header with Clear All button */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          Selected Assets
        </span>
        {onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-red-500"
            onClick={onClearAll}
          >
            <Trash2Icon className="h-3.5 w-3.5 mr-1" />
            Clear All
          </Button>
        )}
      </div>
      {Object.entries(assetsByTeam).map(([teamIdStr, assets]) => {
        const teamId = parseInt(teamIdStr);
        const team = selectedTeams.find((t) => t.id === teamId);
        if (!team) return null;

        return (
          <div key={teamId} className="space-y-2">
            {/* Team Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              {team.logos?.[0] && (
                <Image
                  src={team.logos[0].href}
                  alt={team.displayName}
                  width={28}
                  height={28}
                  className="object-contain"
                />
              )}
              <span className="text-sm font-medium">{team.displayName}</span>
              <span className="text-xs text-muted-foreground">
                ({assets.length} asset{assets.length !== 1 ? "s" : ""})
              </span>
            </div>

            {/* Assets */}
            <div className="space-y-2">
              {assets.map((asset) => {
                const details = getAssetDetails(asset);
                const { toTeam, player, pick } = details;

                return (
                  <div
                    key={`${asset.type}-${asset.id}`}
                    className="flex items-center justify-between p-2.5 rounded-md border border-border bg-slate-950"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Player details */}
                      {asset.type === "player" && player && (
                        <>
                          {player.headshot && (
                            <div className="bg-white/20 p-1 rounded-full flex-shrink-0">
                              <Image
                                src={player.headshot.href}
                                alt={player.displayName}
                                width={80}
                                height={80}
                                className="rounded-full object-cover w-10 h-10"
                              />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">
                              {player.displayName}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({player.position?.abbreviation || "Unknown"})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {player.contract
                                ? `$${(
                                    player.contract.salary / 1000000
                                  ).toFixed(1)}M`
                                : "No contract"}
                              {player.contract?.yearsRemaining && (
                                <>
                                  {" · "}
                                  {player.contract.yearsRemaining}
                                  {player.contract.yearsRemaining === 1
                                    ? " yr"
                                    : " yrs"}
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Pick details */}
                      {asset.type === "pick" && pick && (
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">
                            {pick.year} Round {pick.round} Pick
                          </div>
                          {pick.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {pick.description}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Target team indicator */}
                      {toTeam && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
                          {toTeam.logos?.[0] && (
                            <Image
                              src={toTeam.logos[0].href}
                              alt={toTeam.displayName}
                              width={24}
                              height={24}
                              className="object-contain"
                            />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {toTeam.abbreviation}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500 flex-shrink-0 ml-2"
                      onClick={() => onRemoveAsset(asset.id, asset.type)}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                      <span className="sr-only">Remove from trade</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
