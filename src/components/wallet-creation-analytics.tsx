'use client';

import { useEffect, useState, useMemo } from 'react';

interface WalletCreationDataPoint {
  timestamp: number;
  count: number;
  method: 'email' | 'social' | 'passkey' | 'connect';
  chain: string;
}

interface WalletCreationAnalyticsProps {
  data: WalletCreationDataPoint[];
  timeRange?: '7d' | '30d' | '90d';
}

interface AnalyticsMetric {
  total: number;
  averageDaily: number;
  growthRate: number;
  topMethod: string;
  byChain: Record<string, number>;
}

export function WalletCreationAnalytics({
  data,
  timeRange = '30d',
}: WalletCreationAnalyticsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const filteredData = useMemo(() => {
    const now = Date.now();
    const ranges = { '7d': 604800000, '30d': 2592000000, '90d': 7776000000 };
    const cutoff = now - (ranges[timeRange] || ranges['30d']);
    return data.filter((d) => d.timestamp >= cutoff);
  }, [data, timeRange]);

  const metrics: AnalyticsMetric = useMemo(() => {
    const total = filteredData.reduce((sum, d) => sum + d.count, 0);
    const days = Math.max(filteredData.length, 1);
    const averageDaily = total / days;

    const groupedByMethod: Record<string, number> = {};
    const groupedByChain: Record<string, number> = {};
    filteredData.forEach((d) => {
      groupedByMethod[d.method] = (groupedByMethod[d.method] || 0) + d.count;
      groupedByChain[d.chain] = (groupedByChain[d.chain] || 0) + d.count;
    });

    const topMethod = Object.entries(groupedByMethod).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || 'N/A';

    const growthRate = filteredData.length > 7
      ? ((filteredData.slice(-7).reduce((s, d) => s + d.count, 0) / 7) /
          (filteredData.slice(0, 7).reduce((s, d) => s + d.count, 0) / 7) - 1) * 100
      : 0;

    return {
      total,
      averageDaily,
      growthRate,
      topMethod,
      byChain: groupedByChain,
    };
  }, [filteredData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full p-4 bg-gray-900 rounded-lg">
      <h3 className="text-sm font-medium text-white mb-4">
        Wallet Creation Analytics
      </h3>
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-700 rounded w-1/4" />
          <div className="h-32 bg-gray-700 rounded" />
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm">Error: {error.message}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded p-3">
              <p className="text-gray-400 text-xs">Total Created</p>
              <p className="text-white text-xl font-bold">{metrics.total.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <p className="text-gray-400 text-xs">Daily Average</p>
              <p className="text-white text-xl font-bold">{metrics.averageDaily.toFixed(1)}</p>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <p className="text-gray-400 text-xs">Growth Rate</p>
              <p className={`text-xl font-bold ${metrics.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {metrics.growthRate >= 0 ? '+' : ''}{metrics.growthRate.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Top method: <span className="text-white">{metrics.topMethod}</span>
          </div>
          <div className="flex gap-2">
            {Object.entries(metrics.byChain).map(([chain, count]) => (
              <span key={chain} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                {chain}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
