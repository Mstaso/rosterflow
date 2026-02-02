"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import { saveTradeAction } from "~/actions/trades";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, SignInButton } from "@clerk/nextjs";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";
import type { TradeInfo } from "~/types";
import { usePostHog } from "posthog-js/react";

const saveTradeSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  rating: z.number().min(0).max(10),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters"),
});

type SaveTradeFormData = z.infer<typeof saveTradeSchema>;

export interface TradeAssetData {
  type: "player" | "pick";
  teamId: number; // Team the asset is coming from
  targetTeamId: number; // Team the asset is going to
  playerId?: number; // Player ID if type is "player"
  draftPickId?: number; // Draft pick ID if type is "pick"
}

interface SaveTradeModalProps {
  isLoading?: boolean;
  tradeInfo: TradeInfo[];
  isValidTrade: boolean;
  selectedAssets?: {
    id: number;
    type: string;
    teamId: number;
    targetTeamId?: number;
  }[];
  selectedTeamIds?: number[];
}

export const TRADE_STORAGE_KEY = "rosterflows_pending_trade";

export default function SaveTradeModal({
  isLoading = false,
  tradeInfo,
  isValidTrade,
  selectedAssets = [],
  selectedTeamIds = [],
}: SaveTradeModalProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const posthog = usePostHog();

  const form = useForm<SaveTradeFormData>({
    resolver: zodResolver(saveTradeSchema),
    defaultValues: {
      title: "",
      rating: 5,
      description: "",
    },
  });

  const handleCancel = () => {
    setOpen(false);
    form.reset();
  };

  const { user } = useUser();

  const handleOpen = () => {
    if (user?.id) {
      setOpen(true);
    }
  };

  // Parse pick name to extract year and round (e.g., "2025 1st Round Pick" -> { year: 2025, round: 1 })
  const parsePickName = (
    pickName: string
  ): { year: number; round: number } | null => {
    // Match patterns like:
    // "2025 1st Round Pick", "2026 2nd Round" (with ordinal suffix)
    // "2029 1 Round Pick", "2029 2 Round Pick" (without ordinal suffix)
    const yearMatch = pickName.match(/(\d{4})/);
    // Match either "1st", "2nd", etc. OR just "1", "2" followed by "round"
    const roundMatch = pickName.match(/(\d+)(?:st|nd|rd|th)?\s*round/i);

    const yearStr = yearMatch?.[1];
    const roundStr = roundMatch?.[1];

    if (yearStr && roundStr) {
      return {
        year: parseInt(yearStr, 10),
        round: parseInt(roundStr, 10),
      };
    }
    return null;
  };

  // Find the closest matching draft pick from a team's draft picks
  const findMatchingDraftPick = (
    pickName: string,
    teamDraftPicks: NonNullable<(typeof tradeInfo)[0]["team"]>["draftPicks"]
  ): number | undefined => {
    if (!teamDraftPicks || teamDraftPicks.length === 0) return undefined;

    const parsed = parsePickName(pickName);

    if (!parsed) return undefined;

    // Try to find exact match first
    const exactMatch = teamDraftPicks.find(
      (dp) => dp.year === parsed.year && dp.round === parsed.round
    );
    if (exactMatch) return exactMatch.id;

    // If no exact match, find closest by year then round
    const sortedPicks = [...teamDraftPicks].sort((a, b) => {
      const yearDiffA = Math.abs(a.year - parsed.year);
      const yearDiffB = Math.abs(b.year - parsed.year);
      if (yearDiffA !== yearDiffB) return yearDiffA - yearDiffB;
      const roundDiffA = Math.abs(a.round - parsed.round);
      const roundDiffB = Math.abs(b.round - parsed.round);
      return roundDiffA - roundDiffB;
    });

    return sortedPicks[0]?.id;
  };

  // Build trade assets from tradeInfo
  const buildTradeAssets = (): TradeAssetData[] => {
    const assets: TradeAssetData[] = [];

    tradeInfo.forEach((info) => {
      const targetTeamId = info.team?.id;
      if (!targetTeamId) return;

      // Players received by this team (coming from other teams)
      info.playersReceived?.forEach((player) => {
        if (player?.id && player?.teamId) {
          assets.push({
            type: "player",
            teamId: player.teamId, // Original team
            targetTeamId: targetTeamId, // Receiving team
            playerId: player.id,
          });
        }
      });

      // Picks received by this team
      info.picksReceived?.forEach((pick) => {
        // Find the team this pick is coming from (the sender)
        const fromTeam = tradeInfo.find(
          (t) => t.team?.displayName === pick.from
        );

        // Skip if we can't find the sending team or if sender equals receiver
        // (this would mean the pick isn't actually being traded)
        if (!fromTeam?.team?.id || fromTeam.team.id === targetTeamId) {
          return;
        }

        // Use the enriched draft pick ID if available, otherwise fall back to matching by name
        const draftPickId =
          pick.id ||
          pick.draftPick?.id ||
          findMatchingDraftPick(pick.name, fromTeam.team.draftPicks);

        assets.push({
          type: "pick",
          teamId: fromTeam.team.id,
          targetTeamId: targetTeamId,
          draftPickId,
        });
      });
    });

    return assets;
  };

  const handleSubmit = async (data: SaveTradeFormData) => {
    setIsSaving(true);
    try {
      const tradeAssets = buildTradeAssets();

      await saveTradeAction({
        title: data.title,
        description: data.description || "",
        rating: data.rating,
        salaryValid: isValidTrade,
        assets: tradeAssets,
      });

      // Track trade saved event
      posthog?.capture("trade_saved", {
        teams_count: tradeInfo.length,
        teams: tradeInfo.map((t) => t.team?.displayName).filter(Boolean),
        is_valid_trade: isValidTrade,
        rating: data.rating,
      });

      setOpen(false);
      form.reset();

      toast.success("Trade saved successfully!", {
        description: "Your trade has been saved to your collection.",
        action: {
          label: "View Trades",
          onClick: () => router.push("/my-trades"),
        },
      });
    } catch (error) {
      console.error("Error saving trade:", error);
      toast.error("Failed to save trade", {
        description: "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {user?.id ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            onClick={handleOpen}
            className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
              disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
              transition-all duration-150 ease-in-out"
          >
            <SaveIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Save Trade
          </Button>

          <DialogContent className="w-[90vw] max-w-[425px] mx-auto border-white/80 rounded-xl p-4 sm:p-6">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-base sm:text-lg">
                Save Trade
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Add a title and rating to save this trade.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-3 sm:space-y-4"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter trade title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating *</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 11 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Rate this trade from 0-10
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the trade reasoning, benefits, etc..."
                          className="min-h-[70px] sm:min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || isSaving}
                    className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
          disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
          transition-all duration-150 ease-in-out"
                  >
                    {isSaving ? "Saving..." : "Save Trade"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      ) : (
        <SignInButton mode="modal">
          <Button
            className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
            disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
            transition-all duration-150 ease-in-out"
            onClick={() => {
              // Save trade data to localStorage before sign-in redirect
              if (selectedAssets.length > 0 && selectedTeamIds.length > 0) {
                const pendingTrade = {
                  selectedAssets,
                  selectedTeamIds,
                  timestamp: Date.now(),
                };
                localStorage.setItem(
                  TRADE_STORAGE_KEY,
                  JSON.stringify(pendingTrade)
                );
              }
            }}
          >
            <SaveIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Save Trade
          </Button>
        </SignInButton>
      )}
    </>
  );
}
