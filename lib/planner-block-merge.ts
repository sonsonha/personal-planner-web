/** Preserve newer local Session Outcome when a stale planner fetch lands. */

export type OutcomeRevisionBlock = {
  id: string;
  type?: string;
  revision?: number;
  sessionOutcome?: unknown;
};

/**
 * When applying a planner refetch, keep local sessionOutcome if the client
 * already has a higher revision (optimistic tick / in-flight save).
 */
export function mergePlannerBlocksPreservingNewerOutcomes<T extends OutcomeRevisionBlock>(
  previous: T[],
  incoming: T[],
): T[] {
  const priorById = new Map(
    previous
      .filter((block) => block.type !== "external")
      .map((block) => [block.id, block] as const),
  );
  return incoming.map((block) => {
    if (block.type === "external") return block;
    const prior = priorById.get(block.id);
    if (!prior) return block;
    const priorRevision = prior.revision ?? 0;
    const nextRevision = block.revision ?? 0;
    if (priorRevision <= nextRevision) return block;
    if (prior.sessionOutcome === undefined) return block;
    return {
      ...block,
      sessionOutcome: prior.sessionOutcome,
      revision: priorRevision,
    };
  });
}
