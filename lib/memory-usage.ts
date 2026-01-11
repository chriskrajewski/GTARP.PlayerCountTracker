export type MemoryUsageSnapshot = {
  rss_mb: number;
  heap_total_mb: number;
  heap_used_mb: number;
  external_mb: number;
  array_buffers_mb: number;
};

const BYTES_IN_MB = 1024 * 1024;

function bytesToMb(value: number) {
  return Math.round((value / BYTES_IN_MB) * 10) / 10;
}

export function getMemoryUsageSnapshot(): MemoryUsageSnapshot | null {
  if (typeof process === "undefined" || typeof process.memoryUsage !== "function") {
    return null;
  }

  const usage = process.memoryUsage();

  return {
    rss_mb: bytesToMb(usage.rss),
    heap_total_mb: bytesToMb(usage.heapTotal),
    heap_used_mb: bytesToMb(usage.heapUsed),
    external_mb: bytesToMb(usage.external),
    array_buffers_mb: bytesToMb(usage.arrayBuffers ?? 0),
  };
}

