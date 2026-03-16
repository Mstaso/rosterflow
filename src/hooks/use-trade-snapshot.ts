"use client";

import { useRef, useState, useCallback } from "react";
import { domToPng } from "modern-screenshot";
import { toast } from "sonner";

export function useTradeSnapshot() {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!captureRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const element = captureRef.current;
      const rect = element.getBoundingClientRect();

      // Temporarily lock the element's width so nothing reflows in the clone
      const originalWidth = element.style.width;
      const originalMinWidth = element.style.minWidth;
      element.style.width = `${rect.width}px`;
      element.style.minWidth = `${rect.width}px`;

      const dataUrl = await domToPng(element, {
        scale: 2,
        backgroundColor: "#030712",
        width: rect.width + 48,
        height: rect.height + 48,
        style: {
          padding: "24px",
        },
      });

      // Restore original styles
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;

      // Always download as PNG
      const link = document.createElement("a");
      link.download = `trade-snapshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      // Also try to copy to clipboard
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast.success("Snapshot downloaded and copied to clipboard!");
      } catch {
        toast.success("Trade snapshot downloaded!");
      }
    } catch (error) {
      console.error("Snapshot failed:", error);
      toast.error("Failed to capture snapshot. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  return { captureRef, capture, isCapturing };
}
