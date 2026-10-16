export const dashboardPlateIds = ["readout", "next", "decisions", "gaps", "week", "risks", "channels", "profile"] as const;
export type DashboardPlateId = (typeof dashboardPlateIds)[number];
export type PlateSize = "S" | "M" | "L" | "XL";
export type DashboardPlate = { id: DashboardPlateId;size: PlateSize;hidden: boolean };
export type DashboardLayout = { version: 1;plates: DashboardPlate[] };
export const plateCatalog: Record<DashboardPlateId,{ title: string;allowedSizes: readonly PlateSize[];defaultSize: PlateSize }> = {
  readout: { title: "Progress readout",allowedSizes: ["M","L"],defaultSize: "M" },
  next: { title: "Next actions",allowedSizes: ["S","M"],defaultSize: "M" },
  decisions: { title: "Decisions",allowedSizes: ["L","XL"],defaultSize: "L" },
  gaps: { title: "Missing inputs",allowedSizes: ["S","M"],defaultSize: "S" },
  week: { title: "This week",allowedSizes: ["S","M","L"],defaultSize: "L" },
  risks: { title: "Risk watch",allowedSizes: ["S","M"],defaultSize: "S" },
  channels: { title: "Channel experiment",allowedSizes: ["S","M"],defaultSize: "S" },
  profile: { title: "Profile snapshot",allowedSizes: ["S","M"],defaultSize: "S" },
};
// Authored default: active work and the riskiest belief lead; supplementary context starts hidden but restorable.
const defaultOrder: readonly DashboardPlateId[] = ["week", "risks", "readout", "next", "decisions", "gaps", "channels", "profile"];
const defaultHidden: ReadonlySet<DashboardPlateId> = new Set(["channels", "profile"]);
export function defaultDashboardLayout(): DashboardLayout {
  return { version: 1,plates: defaultOrder.map(id => ({ id,size: plateCatalog[id].defaultSize,hidden: defaultHidden.has(id) })) };
}
