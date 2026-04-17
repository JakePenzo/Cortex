import React from "react";
import { Box, Text } from "ink";
import type { DayStats } from "../../cache/sqlite.js";

interface Props {
  stats: DayStats;
  cacheRate: number;
}

export function StatsPanel({ stats, cacheRate }: Props) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">TODAY</Text>
      <Box marginTop={1} flexDirection="column">
        <StatRow label="Queries" value={stats.queries} color="cyan" />
        <StatRow label="Writes" value={stats.writes} color="cyan" />
        <StatRow label="Cache hits" value={`${stats.cache_hits} (${cacheRate}%)`} color={cacheRate > 50 ? "green" : "yellow"} />
        <StatRow label="Avg latency" value={`${stats.avg_latency_ms}ms`} color="cyan" />
      </Box>
      {stats.queries > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Cache efficiency</Text>
          <CacheBar rate={cacheRate} />
        </Box>
      )}
    </Box>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Box>
      <Text color="gray">{label.padEnd(12)}</Text>
      <Text color={color as any} bold>{String(value)}</Text>
    </Box>
  );
}

function CacheBar({ rate }: { rate: number }) {
  const width = 28;
  const filled = Math.round((rate / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const color = rate > 66 ? "green" : rate > 33 ? "yellow" : "red";
  return (
    <Box>
      <Text color={color as any}>{bar}</Text>
      <Text color="gray"> {rate}%</Text>
    </Box>
  );
}
