import type { MappedAssumption } from "@/lib/domain/insights";

// Illustrative landing-only scenario: different priorities and stages of testing
// make all four regions legible. Never changes workspace evidence or task states.
const positions = [
  [0.82, 0.16], [0.7, 0.77], [0.32, 0.3],
  [0.88, 0.39], [0.25, 0.74], [0.62, 0.62],
] as const;

export function exampleMap(items: MappedAssumption[]): MappedAssumption[] {
  return items.map((item, i) => {
    const [importance, evidence] = positions[i % positions.length];
    return { ...item, importance, evidence,
      quadrant: importance >= 0.5 ? (evidence < 0.5 ? "test_first" : "proceed") : (evidence < 0.5 ? "park" : "monitor") };
  });
}
