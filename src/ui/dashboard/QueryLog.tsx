import React from "react";
import { Box, Text } from "ink";

export interface QueryEntry {
  query: string;
  backends: string[];
  latency_ms: number;
  results: number;
  ts: Date;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function QueryLog({ entries }: { entries: QueryEntry[] }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">QUERY LOG</Text>
      <Box marginTop={1} flexDirection="column">
        {entries.length === 0 && <Text color="gray">  No queries yet</Text>}
        {entries.map((e, i) => (
          <Box key={i}>
            <Text color="gray">{relativeTime(e.ts).padEnd(10)}</Text>
            <Text color="cyan">{truncate(e.query, 40).padEnd(42)}</Text>
            <Text color="gray">{String(e.latency_ms).padStart(4)}ms  </Text>
            <Text color={e.results > 0 ? "green" : "gray"}>{e.results} results</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
