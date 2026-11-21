"use client";

import { useEffect, useState } from "react";
import { probeRepo, type RepoProbe } from "./probe";

/**
 * Availability and size of each repo's own tokenizer, probed in the background
 * (one HEAD request each, memoized). `undefined` means "still checking".
 */
export function useRepoProbes(repos: string[]): Record<string, RepoProbe | undefined> {
  const [results, setResults] = useState<Record<string, RepoProbe>>({});
  const key = repos.join("|");

  useEffect(() => {
    let alive = true;
    for (const repo of key ? key.split("|") : []) {
      void probeRepo(repo).then((probe) => {
        if (alive) setResults((prev) => (prev[repo] === probe ? prev : { ...prev, [repo]: probe }));
      });
    }
    return () => {
      alive = false;
    };
  }, [key]);

  return results;
}
