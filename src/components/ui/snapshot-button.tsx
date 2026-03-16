"use client";

import { CameraIcon, Loader2Icon } from "lucide-react";
import { Button } from "./button";
import { cn } from "~/lib/utils";

interface SnapshotButtonProps {
  onClick: () => void;
  isCapturing: boolean;
  className?: string;
}

export function SnapshotButton({
  onClick,
  isCapturing,
  className,
}: SnapshotButtonProps) {
  return (
    <Button
      variant="edit"
      className={cn("w-full sm:w-auto", className)}
      onClick={onClick}
      disabled={isCapturing}
    >
      {isCapturing ? (
        <Loader2Icon className="h-4 w-4 animate-spin" />
      ) : (
        <CameraIcon className="h-4 w-4" />
      )}
      <span>{isCapturing ? "Capturing..." : "Snapshot"}</span>
    </Button>
  );
}
