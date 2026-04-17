import React from "react";
import { Box, Text } from "ink";

interface BackendStatus {
  name: string;
  available: boolean;
  total_memories: number;
  avg_latency_ms: number;
  version?: string;
}

const BACKEND_COLORS: Record<string, string> = {
  qmd: "blue",
  openmemory: "magenta",
  byterover: "green",
};

export function BackendPanel({ backends }: { backends: BackendStatus[] }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">BACKENDS</Text>
      <Box marginTop={1} flexDirection="column">
        {backends.length === 0 && <Text color="gray">  No backends configured</Text>}
        {backends.map(b => (
          <Box key={b.name} marginBottom={0}>
            <Text color={b.available ? "green" : "yellow"}>{b.available ? "●" : "○"} </Text>
            <Text color={BACKEND_COLORS[b.name] ?? "white"} bold>{b.name.padEnd(14)}</Text>
            <Text color={b.available ? "green" : "gray"}>{b.available ? "✓ running  " : "✗ offline  "}</Text>
            <Text color="gray">
              {b.available ? `${b.total_memories.toLocaleString()} memories` : "—"}
            </Text>
            {b.available && b.avg_latency_ms > 0 && (
              <Text color="gray">{"  "}{b.avg_latency_ms}ms</Text>
            )}
            {b.version && <Text color="gray">{"  "}({b.version})</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
