import React from "react";
import { Box, Text } from "ink";
import type { MemoryResult } from "../../router/types.js";

const TYPE_COLORS: Record<string, string> = {
  preference: "magenta",
  decision: "yellow",
  fact: "blue",
  session: "cyan",
  document: "gray",
};

const BACKEND_COLORS: Record<string, string> = {
  qmd: "blue",
  openmemory: "magenta",
  byterover: "green",
  local: "gray",
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function MemoryList({ memories }: { memories: MemoryResult[] }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">RECENT MEMORIES</Text>
      <Box marginTop={1} flexDirection="column">
        {memories.length === 0 && (
          <Text color="gray">  No memories yet. Try: cortex add "your memory"</Text>
        )}
        {memories.map((m, i) => (
          <Box key={m.id} marginBottom={0}>
            <Text color="gray">{String(i + 1).padStart(2)}. </Text>
            <Text color={TYPE_COLORS[m.type] ?? "white"}>{"[" + m.type + "]".padEnd(12)}</Text>
            <Text>{truncate(m.content, 52)}</Text>
            <Text color="gray">{"  "}</Text>
            <Text color={BACKEND_COLORS[m.backend] ?? "gray"}>{m.backend}</Text>
            <Text color="gray">{"  "}{relativeTime(m.created_at)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
