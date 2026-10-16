export const dashboardPlateIds = ["readout", "next", "decisions", "gaps", "week", "risks", "channels", "profile"] as const;
export type DashboardPlateId = (typeof dashboardPlateIds)[number];
export type PlateSize = "S" | "M" | "L" | "XL";
export type DashboardPlate = { id: DashboardPlateId;size: PlateSize;hidden: boolean };
export type DashboardLayout = { version: 1;plates: DashboardPlate[] };
export const plateCatalog: Record<DashboardPlateId,{ title: string;allowedSizes: readonly PlateSize[];defaultSize: PlateSize }> = {
  readout: { title: "Strategy readout",allowedSizes: ["M","L"],defaultSize: "L" },
  next: { title: "Next actions",allowedSizes: ["S","M"],defaultSize: "S" },
  decisions: { title: "Decisions",allowedSizes: ["L","XL"],defaultSize: "XL" },
  gaps: { title: "Missing inputs",allowedSizes: ["S","M"],defaultSize: "M" },
  week: { title: "This week",allowedSizes: ["S","M"],defaultSize: "M" },
  risks: { title: "Risk watch",allowedSizes: ["S","M"],defaultSize: "M" },
  channels: { title: "Channel experiment",allowedSizes: ["S","M"],defaultSize: "S" },
  profile: { title: "Profile snapshot",allowedSizes: ["S","M"],defaultSize: "S" },
};
export function defaultDashboardLayout(): DashboardLayout {
  return { version: 1,plates: dashboardPlateIds.map(id => ({ id,size: plateCatalog[id].defaultSize,hidden: false })) };
}
