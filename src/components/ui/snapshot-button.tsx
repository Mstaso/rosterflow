"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CameraIcon, Loader2Icon } from "lucide-react";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { cn } from "~/lib/utils";

const TOOLTIP_STORAGE_KEY = "rosterflow-snapshot-tooltip-shown";

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
  const [autoShow, setAutoShow] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState<boolean | undefined>(
    undefined
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const alreadyShown = localStorage.getItem(TOOLTIP_STORAGE_KEY);
    if (!alreadyShown) {
      setAutoShow(true);
      setTooltipOpen(true);
      timerRef.current = setTimeout(() => {
        setTooltipOpen(undefined);
        setAutoShow(false);
        localStorage.setItem(TOOLTIP_STORAGE_KEY, "true");
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismissTooltip = useCallback(() => {
    if (autoShow) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTooltipOpen(undefined);
      setAutoShow(false);
      localStorage.setItem(TOOLTIP_STORAGE_KEY, "true");
    }
  }, [autoShow]);

  const handleClick = () => {
    dismissTooltip();
    onClick();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={tooltipOpen} onOpenChange={autoShow ? undefined : setTooltipOpen}>
        <TooltipTrigger asChild>
          <Button
            variant="edit"
            className={cn("w-full sm:w-auto", className)}
            onClick={handleClick}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <CameraIcon className="h-4 w-4" />
            )}
            <span>{isCapturing ? "Capturing..." : "Snapshot"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="ghost-border bg-surface-container text-foreground font-medium backdrop-blur-xl">
          Save this trade as an image
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
