import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { BackendPanel } from "./BackendPanel.js";
import { StatsPanel } from "./StatsPanel.js";
import { MemoryList } from "./MemoryList.js";
import { QueryLog } from "./QueryLog.js";
import type { BackendAdapter } from "../../backends/base.js";
import { getTodayStats, getRecentMemories } from "../../cache/sqlite.js";
import type { DayStats } from "../../cache/sqlite.js";
import type { MemoryResult } from "../../router/types.js";

interface Props {
  backends: BackendAdapter[];
  live: boolean;
}

interface BackendStatus {
  name: string;
  available: boolean;
  total_memories: number;
  avg_latency_ms: number;
  version?: string;
}

export function App({ backends, live }: Props) {
  const { exit } = useApp();
  const [backendStats, setBackendStats] = useState<BackendStatus[]>([]);
  const [dayStats, setDayStats] = useState<DayStats>({ queries: 0, writes: 0, cache_hits: 0, avg_latency_ms: 0, backends_used: [] });
  const [memories, setMemories] = useState<MemoryResult[]>([]);
  const [tick, setTick] = useState(0);

  useInput((input) => {
    if (input === "q" || input === "\x03") exit();
  });

  async function refresh() {
    const stats = await Promise.all(backends.map(b => b.stats()));
    setBackendStats(stats);
    setDayStats(getTodayStats());
    setMemories(getRecentMemories(8));
  }

  useEffect(() => {
    refresh();
  }, [tick]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [live]);

  const cacheRate = dayStats.queries > 0 ? Math.round((dayStats.cache_hits / dayStats.queries) * 100) : 0;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">CORTEX</Text>
        <Text color="gray">  v0.1.0  ·  memory router</Text>
        {live && <Text color="green">  ● live</Text>}
        <Text color="gray">  (q to quit)</Text>
      </Box>

      {/* Top row: backends + today stats */}
      <Box flexDirection="row" marginBottom={1}>
        <Box flexDirection="column" flexGrow={1} marginRight={2}>
          <BackendPanel backends={backendStats} />
        </Box>
        <Box flexDirection="column" width={36}>
          <StatsPanel stats={dayStats} cacheRate={cacheRate} />
        </Box>
      </Box>

      {/* Bottom row: recent memories */}
      <Box flexDirection="column">
        <MemoryList memories={memories} />
      </Box>
    </Box>
  );
}
