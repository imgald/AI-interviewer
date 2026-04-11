"use client";

import dynamic from "next/dynamic";

const Excalidraw = dynamic(
  async () => {
    const mod = await import("@excalidraw/excalidraw");
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 620,
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--surface-alt)",
        }}
      />
    ),
  },
);

export function SystemDesignWhiteboard() {
  return (
    <div
      style={{
        height: 620,
        borderRadius: 18,
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <Excalidraw />
    </div>
  );
}
