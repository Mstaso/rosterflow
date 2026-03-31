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

      // Force desktop grid layout for snapshot (even on mobile)
      // Find grid containers that use md:grid and force them to grid display
      const gridContainers = element.querySelectorAll<HTMLElement>('.md\\:grid');
      const savedGridStyles: {
        el: HTMLElement;
        display: string;
        flexDirection: string;
        overflow: string;
        width: string;
        gridTemplateColumns: string;
      }[] = [];

      for (const container of gridContainers) {
        const computed = getComputedStyle(container);
        savedGridStyles.push({
          el: container,
          display: container.style.display,
          flexDirection: container.style.flexDirection,
          overflow: container.style.overflow,
          width: container.style.width,
          gridTemplateColumns: container.style.gridTemplateColumns,
        });

        // Force grid layout with the inline gridTemplateColumns already set
        container.style.display = 'grid';
        container.style.overflow = 'visible';

        // Count direct card children to determine column count
        const cardCount = container.querySelectorAll(':scope > div, :scope > [class*="Card"]').length;
        if (cardCount > 0 && !container.style.gridTemplateColumns) {
          container.style.gridTemplateColumns = `repeat(${cardCount}, minmax(280px, 1fr))`;
        }
      }

      // Set a minimum width to ensure desktop-like rendering
      const desiredWidth = Math.max(1024, element.scrollWidth);

      // Temporarily lock the element's width
      const originalWidth = element.style.width;
      const originalMinWidth = element.style.minWidth;
      element.style.width = `${desiredWidth}px`;
      element.style.minWidth = `${desiredWidth}px`;

      // Allow layout to reflow
      await new Promise((r) => requestAnimationFrame(r));

      const fullWidth = element.scrollWidth;
      const fullHeight = element.scrollHeight;

      const dataUrl = await domToPng(element, {
        scale: 2,
        backgroundColor: "#030712",
        width: fullWidth + 48,
        height: fullHeight + 48,
        style: {
          padding: "24px",
        },
      });

      // Restore all styles
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;

      for (const saved of savedGridStyles) {
        saved.el.style.display = saved.display;
        saved.el.style.flexDirection = saved.flexDirection;
        saved.el.style.overflow = saved.overflow;
        saved.el.style.width = saved.width;
        saved.el.style.gridTemplateColumns = saved.gridTemplateColumns;
      }

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
