"use client";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  ArrowLeft,
  TrashIcon,
  CalendarIcon,
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  UsersIcon,
  FileTextIcon,
  PencilIcon,
  ArrowBigUp,
  ArrowBigDown,
  MessageCircleIcon,
  SendIcon,
  Loader2Icon,
  ShareIcon,
  CheckIcon,
} from "lucide-react";
import {
  deleteTrade,
  voteOnTrade,
  createComment,
  deleteComment,
} from "~/actions/trades";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import Image from "next/image";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { PlayerStatsModal } from "~/components/player-stats-modal";
import type { Player } from "~/types";
import { getDisplayName } from "~/lib/username-generator";

type TradeComment = {
  id: number;
  userId: string;
  userName: string;
  content: string;
  tradeId: number;
  createdAt: Date;
  updatedAt: Date;
};

type SavedTradeWithAssets = {
  id: number;
  userId: string | null;
  title: string;
  description: string;
  rating: number;
  salaryValid: boolean;
  createdAt: Date;
  updatedAt: Date;
  assets: {
    id: number;
    type: string;
    teamId: number;
    targetTeamId: number;
    playerId: number | null;
    draftPickId: number | null;
    player: {
      id: number;
      displayName: string;
      fullName: string;
      headshot: any;
      position: any;
      contract: any;
    } | null;
    draftPick: {
      id: number;
      year: number;
      round: number;
      description: string | null;
    } | null;
    team: {
      id: number;
      displayName: string;
      abbreviation: string;
      logos: any;
      totalCapAllocation: number;
      capSpace: number;
      firstApronSpace: number;
      secondApronSpace: number;
    };
    targetTeam: {
      id: number;
      displayName: string;
      abbreviation: string;
      logos: any;
      totalCapAllocation: number;
      capSpace: number;
      firstApronSpace: number;
      secondApronSpace: number;
    };
  }[];
  votes?: {
    id: number;
    userId: string;
    tradeId: number;
    value: number;
  }[];
  comments?: TradeComment[];
};

type TradeAsset = SavedTradeWithAssets["assets"][0];

type TeamTradeInfo = {
  team: TradeAsset["targetTeam"];
  playersReceived: TradeAsset[];
  picksReceived: TradeAsset[];
  outgoingSalary: number;
  incomingSalary: number;
  capDifference: number;
};

export function SavedTradeDetail({
  trade,
  currentUserId,
}: {
  trade: SavedTradeWithAssets;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const { user } = useUser();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null
  );
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [signInAction, setSignInAction] = useState<"vote" | "comment">("vote");
  const [selectedPlayer, setSelectedPlayer] = useState<{
    player: SavedTradeWithAssets["assets"][0]["player"];
    teamColor?: string;
    teamAltColor?: string;
  } | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const isLoggedIn = !!currentUserId;

  const handleOpenPlayerStats = (
    player: SavedTradeWithAssets["assets"][0]["player"],
    teamColor?: string,
    teamAltColor?: string
  ) => {
    if (!player) return;
    setSelectedPlayer({ player, teamColor, teamAltColor });
    setIsStatsModalOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTrade(trade.id);
      router.push("/my-trades");
    } catch (error) {
      console.error("Error deleting trade:", error);
      setIsDeleting(false);
    }
  };

  const handleVote = async (value: 1 | -1) => {
    if (!isLoggedIn) {
      setSignInAction("vote");
      setShowSignInPrompt(true);
      return;
    }

    setIsVoting(true);
    try {
      await voteOnTrade(trade.id, value);
      router.refresh();
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!isLoggedIn) {
      setSignInAction("comment");
      setShowSignInPrompt(true);
      return;
    }

    if (!commentText.trim() || !user) return;

    setIsSubmittingComment(true);
    try {
      // Use Clerk username if set, otherwise generate NBA-themed username
      const userName = getDisplayName(user.id, user.username);
      await createComment({
        tradeId: trade.id,
        content: commentText.trim(),
        userName,
      });
      setCommentText("");
      router.refresh();
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    setDeletingCommentId(commentId);
    try {
      await deleteComment(commentId);
      router.refresh();
    } catch (error) {
      console.error("Error deleting comment:", error);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/my-trades/${trade.id}`;
    const shareData = {
      title: trade.title,
      text: trade.description || `Check out this NBA trade: ${trade.title}`,
      url: shareUrl,
    };

    // Try native share API first (works on mobile and some desktop browsers)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // User cancelled or share failed - fall back to clipboard
        if ((error as Error).name !== "AbortError") {
          await copyToClipboard(shareUrl);
        }
      }
    } else {
      // Fall back to clipboard copy for desktop
      await copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const formatCommentDate = (date: Date) => {
    const now = new Date();
    const commentDate = new Date(date);
    const diffInMs = now.getTime() - commentDate.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return "just now";
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return commentDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getVoteInfo = () => {
    const votes = trade.votes || [];
    const upvotes = votes.filter((v) => v.value === 1).length;
    const downvotes = votes.filter((v) => v.value === -1).length;
    const score = upvotes - downvotes;
    const userVote = votes.find((v) => v.userId === currentUserId)?.value ?? 0;
    return { score, userVote };
  };

  const { score, userVote } = getVoteInfo();
  const isOwnTrade = trade.userId === currentUserId;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group assets by target team to show what each team receives
  const groupAssetsByTargetTeam = (): TeamTradeInfo[] => {
    const teamMap = new Map<number, TeamTradeInfo>();

    trade.assets.forEach((asset) => {
      const targetTeamId = asset.targetTeamId;

      if (!teamMap.has(targetTeamId)) {
        teamMap.set(targetTeamId, {
          team: asset.targetTeam,
          playersReceived: [],
          picksReceived: [],
          outgoingSalary: 0,
          incomingSalary: 0,
          capDifference: 0,
        });
      }

      const teamInfo = teamMap.get(targetTeamId)!;

      if (asset.type === "player" && asset.player) {
        teamInfo.playersReceived.push(asset);
        teamInfo.incomingSalary += asset.player.contract?.salary || 0;
      } else if (asset.type === "pick" && asset.draftPick) {
        teamInfo.picksReceived.push(asset);
      }
    });

    // Calculate outgoing salary for each team
    trade.assets.forEach((asset) => {
      const fromTeamId = asset.teamId;
      if (teamMap.has(fromTeamId) && asset.type === "player" && asset.player) {
        const teamInfo = teamMap.get(fromTeamId)!;
        teamInfo.outgoingSalary += asset.player.contract?.salary || 0;
      }
    });

    // Calculate cap difference
    teamMap.forEach((teamInfo) => {
      teamInfo.capDifference =
        teamInfo.incomingSalary - teamInfo.outgoingSalary;
    });

    return Array.from(teamMap.values());
  };

  const teamsInfo = groupAssetsByTargetTeam();

  // Calculate updated tax value after trade
  const calculateUpdatedTaxValue = (
    currentValue: number,
    capDifference: number
  ) => {
    if (currentValue < 0 && capDifference < 0) {
      return currentValue + capDifference;
    } else if (currentValue < 0 && capDifference > 0) {
      return currentValue - capDifference;
    } else if (currentValue > 0 && capDifference > 0) {
      return currentValue - capDifference;
    } else if (currentValue > 0 && capDifference < 0) {
      return currentValue - capDifference;
    } else {
      return 0;
    }
  };

  // Build URL params to edit trade in trade machine
  const handleEditTrade = () => {
    // Get unique team IDs involved in the trade
    const teamIds = new Set<number>();
    trade.assets.forEach((asset) => {
      teamIds.add(asset.teamId);
      teamIds.add(asset.targetTeamId);
    });

    // Build selected assets array
    const selectedAssets = trade.assets.map((asset) => ({
      id: asset.type === "player" ? asset.playerId : asset.draftPickId,
      type: asset.type,
      teamId: asset.teamId,
      targetTeamId: asset.targetTeamId,
    }));

    // Encode the data as URL params
    const params = new URLSearchParams();
    params.set("teamIds", Array.from(teamIds).join(","));
    params.set("assets", JSON.stringify(selectedAssets));

    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex-grow">
      {/* Sign In Prompt Dialog */}
      <AlertDialog open={showSignInPrompt} onOpenChange={setShowSignInPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sign in to {signInAction === "vote" ? "vote" : "comment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              You need to be signed in to{" "}
              {signInAction === "vote" ? "vote on trades" : "leave comments"}.
              Create an account or sign in to participate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SignInButton mode="modal">
              <Button
                className="bg-indigoMain hover:bg-indigoMain/90"
                onClick={() => setShowSignInPrompt(false)}
              >
                Sign In
              </Button>
            </SignInButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => router.push("/my-trades")}
            variant="ghost"
            className="text-muted-foreground p-0 h-auto hover:text-white hover:bg-transparent mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4 text-indigoMain" />
            Back to My Trades
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex gap-4">
              {/* Vote buttons */}
              <div className="flex flex-col items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-md transition-all duration-200",
                    userVote === 1
                      ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 scale-110"
                      : "text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 hover:scale-110"
                  )}
                  disabled={isVoting}
                  onClick={() => handleVote(1)}
                >
                  <ArrowBigUp
                    className={cn(
                      "h-6 w-6 transition-all duration-200",
                      userVote === 1 && "fill-current"
                    )}
                  />
                </Button>
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums transition-colors duration-200",
                    score > 0 && "text-orange-500",
                    score < 0 && "text-blue-500",
                    score === 0 && "text-muted-foreground"
                  )}
                >
                  {score}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-md transition-all duration-200",
                    userVote === -1
                      ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 scale-110"
                      : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 hover:scale-110"
                  )}
                  disabled={isVoting}
                  onClick={() => handleVote(-1)}
                >
                  <ArrowBigDown
                    className={cn(
                      "h-6 w-6 transition-all duration-200",
                      userVote === -1 && "fill-current"
                    )}
                  />
                </Button>
              </div>

              <div>
                <h1 className="text-2xl font-bold mb-2">{trade.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    {formatDate(trade.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <StarIcon className="h-4 w-4 text-yellow-500" />
                    {trade.rating}/10
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-4">
                  {trade.salaryValid ? (
                    <Badge
                      variant="outline"
                      className="text-green-500 border-green-500"
                    >
                      <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                      Salary Valid
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-orange-500 border-orange-500"
                    >
                      <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                      Salary Invalid
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="bg-indigoMain hover:bg-indigoMain/90 text-white"
                onClick={handleShare}
              >
                {shareStatus === "copied" ? (
                  <>
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ShareIcon className="h-4 w-4 mr-2" />
                    Share
                  </>
                )}
              </Button>
              {isOwnTrade && (
                <>
                  <Button
                    variant="outline"
                    className="border-white/50"
                    onClick={handleEditTrade}
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                        disabled={isDeleting}
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Trade</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{trade.title}"? This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mt-4">{trade.description}</p>
        </div>

        {/* Trade Cards - Similar to trade-card.tsx */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          {teamsInfo.map((teamInfo, index) => (
            <Card
              key={index}
              className="flex flex-col h-auto overflow-hidden border-white/30 bg-gradient-to-br from-background via-background/95 to-muted/80 md:flex-1"
            >
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2 pt-4 px-4 bg-muted/60">
                <div className="flex items-center gap-2">
                  {teamInfo.team.logos?.[0]?.href && (
                    <Image
                      src={teamInfo.team.logos[0].href}
                      alt={teamInfo.team.displayName}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  )}
                  <span className="text-lg font-semibold">
                    {teamInfo.team.displayName}
                  </span>
                </div>
              </CardHeader>

              {/* Salary Info */}
              <div className="px-4 py-3 bg-muted/10">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Outgoing Salary
                    </div>
                    <div className="text-sm font-medium">
                      ${(teamInfo.outgoingSalary / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Incoming Salary
                    </div>
                    <div className="text-sm font-medium">
                      ${(teamInfo.incomingSalary / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Cap Difference
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        teamInfo.capDifference > 0
                          ? "text-red-500"
                          : teamInfo.capDifference < 0
                          ? "text-green-500"
                          : "text-foreground"
                      }`}
                    >
                      ${(teamInfo.capDifference / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="px-4 py-4 flex-grow flex flex-col bg-muted/60 border-indigoMain">
                {/* Updated Team Cap Info */}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">
                    Updated Team Cap Info
                  </div>
                  <table className="w-full border border-border rounded text-xs">
                    <tbody>
                      <tr className="bg-muted/40">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          Total Cap
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {teamInfo.team.totalCapAllocation
                            ? (
                                teamInfo.team.totalCapAllocation / 1000000
                              ).toFixed(1)
                            : "0.0"}
                          M
                        </td>
                      </tr>
                      <tr className="bg-background">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          Cap Space
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {(
                            calculateUpdatedTaxValue(
                              teamInfo.team.capSpace || 0,
                              teamInfo.capDifference
                            ) / 1000000
                          ).toFixed(1)}
                          M
                        </td>
                      </tr>
                      <tr className="bg-muted/40">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          1st Apron Space
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {(
                            calculateUpdatedTaxValue(
                              teamInfo.team.firstApronSpace || 0,
                              teamInfo.capDifference
                            ) / 1000000
                          ).toFixed(1)}
                          M
                        </td>
                      </tr>
                      <tr className="bg-background">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          2nd Apron Space
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {(
                            calculateUpdatedTaxValue(
                              teamInfo.team.secondApronSpace || 0,
                              teamInfo.capDifference
                            ) / 1000000
                          ).toFixed(1)}
                          M
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="space-y-6">
                  {/* Players Received */}
                  {teamInfo.playersReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <UsersIcon className="w-4 h-4" strokeWidth={1.5} />
                        Players Received
                      </div>
                      <div className="space-y-3">
                        {teamInfo.playersReceived.map((asset) => (
                          <div
                            key={asset.id}
                            className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950 hover:border-indigoMain/50 cursor-pointer transition-colors"
                            onClick={() =>
                              handleOpenPlayerStats(
                                asset.player,
                                asset.team.logos[0].color as string | undefined
                              )
                            }
                          >
                            <div className="flex items-center gap-3">
                              {asset.player?.headshot?.href && (
                                <div className="bg-white/20 p-1 rounded-full">
                                  <Image
                                    src={asset.player.headshot.href}
                                    alt={asset.player.displayName}
                                    width={96}
                                    height={96}
                                    className="rounded-full object-cover w-12 h-12"
                                  />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">
                                  {asset.player?.displayName}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    (
                                    {asset.player?.position?.abbreviation ||
                                      "Unknown"}
                                    )
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {asset.player?.contract
                                    ? `Salary: $${(
                                        asset.player.contract.salary / 1000000
                                      ).toFixed(1)}M`
                                    : "No contract"}
                                  {asset.player?.contract?.yearsRemaining && (
                                    <>
                                      {" | "}
                                      {asset.player.contract.yearsRemaining}
                                      {` ${
                                        asset.player.contract.yearsRemaining ===
                                        1
                                          ? "yr"
                                          : "yrs"
                                      }`}
                                    </>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  from {asset.team.abbreviation}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Picks Received */}
                  {teamInfo.picksReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <FileTextIcon className="w-4 h-4" strokeWidth={1.5} />
                        Picks Received
                      </div>
                      <div className="space-y-3">
                        {teamInfo.picksReceived.map((asset) => (
                          <div
                            key={asset.id}
                            className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-muted-foreground">
                                from {asset.team.abbreviation}
                              </div>
                              <div className="font-medium text-sm">
                                {asset.draftPick?.year} Round{" "}
                                {asset.draftPick?.round} Pick
                              </div>
                              {asset.draftPick?.description && (
                                <div className="text-xs text-muted-foreground">
                                  {asset.draftPick.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No assets received */}
                  {teamInfo.playersReceived.length === 0 &&
                    teamInfo.picksReceived.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <div className="text-sm">No assets received</div>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <Card className="border-indigoMain bg-gradient-to-br from-background via-background/95 to-muted/80">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <MessageCircleIcon className="h-5 w-5 text-indigoMain" />
                <h2 className="text-lg font-semibold">
                  Comments{" "}
                  {trade.comments && trade.comments.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      ({trade.comments.length})
                    </span>
                  )}
                </h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Comment Input */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Share your thoughts on this trade..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[100px] bg-slate-950 border-border focus:border-indigoMain resize-none"
                  maxLength={1000}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {commentText.length}/1000 characters
                  </span>
                  <Button
                    onClick={handleSubmitComment}
                    disabled={
                      isLoggedIn
                        ? !commentText.trim() || isSubmittingComment
                        : false
                    }
                    className="bg-indigoMain hover:bg-indigoMain/90 text-white"
                  >
                    {isSubmittingComment ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <SendIcon className="h-4 w-4 mr-2" />
                        Post Comment
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Comments List */}
              {trade.comments && trade.comments.length > 0 ? (
                <div className="space-y-4 pt-4 border-t border-border">
                  {trade.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="group flex gap-3 p-4 rounded-lg bg-slate-950/50 border border-border hover:border-indigoMain/50 transition-colors"
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-indigoMain/20 text-indigoMain text-sm font-medium">
                          {getInitials(comment.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {comment.userName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatCommentDate(comment.createdAt)}
                            </span>
                          </div>
                          {comment.userId === currentUserId && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  disabled={deletingCommentId === comment.id}
                                >
                                  {deletingCommentId === comment.id ? (
                                    <Loader2Icon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrashIcon className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Comment
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this
                                    comment? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleDeleteComment(comment.id)
                                    }
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border-t border-border">
                  <MessageCircleIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs mt-1">
                    Be the first to share your thoughts!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        player={
          selectedPlayer?.player
            ? ({
                id: selectedPlayer.player.id,
                firstName: selectedPlayer.player.displayName.split(" ")[0] || "",
                lastName: selectedPlayer.player.displayName.split(" ").slice(1).join(" ") || "",
                fullName: selectedPlayer.player.fullName,
                displayName: selectedPlayer.player.displayName,
                shortName: selectedPlayer.player.displayName,
                weight: 0,
                displayWeight: "",
                height: 0,
                displayHeight: "",
                age: 0,
                dateOfBirth: "",
                jersey: "",
                position: selectedPlayer.player.position as any,
                contract: selectedPlayer.player.contract as any,
                headshot: selectedPlayer.player.headshot as any,
                teamId: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                espnId: (selectedPlayer.player as any).espnId,
              } as Player)
            : null
        }
        espnId={(selectedPlayer?.player as any)?.espnId}
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setSelectedPlayer(null);
        }}
        teamColor={selectedPlayer?.teamColor}
        teamAltColor={selectedPlayer?.teamAltColor}
      />
    </div>
  );
}
