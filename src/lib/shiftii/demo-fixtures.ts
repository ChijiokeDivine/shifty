/** Fictional, non-personal Shiftii demo fixtures. Safe to share and regenerate. */
export type DemoEmployee = {
  key: string;
  name: string;
  role: "MANAGER" | "EMPLOYEE";
  position: string;
  location: string;
  weeklyHours: number;
};

export const DEMO_LOCATIONS = [
  "Downtown Store",
  "Warehouse",
  "Customer Support Hub",
] as const;

export const DEMO_POSITIONS = [
  "Sales Associate",
  "Shift Supervisor",
  "Inventory Specialist",
  "Customer Support Agent",
  "Operations Coordinator",
] as const;

export const DEMO_EMPLOYEES: readonly DemoEmployee[] = [
  { key: "jasmine-okafor", name: "Jasmine Okafor", role: "MANAGER", position: "Shift Supervisor", location: "Downtown Store", weeklyHours: 32 },
  { key: "daniel-brooks", name: "Daniel Brooks", role: "EMPLOYEE", position: "Sales Associate", location: "Downtown Store", weeklyHours: 32 },
  { key: "fatima-bello", name: "Fatima Bello", role: "EMPLOYEE", position: "Sales Associate", location: "Downtown Store", weeklyHours: 32 },
  { key: "chloe-martin", name: "Chloe Martin", role: "EMPLOYEE", position: "Sales Associate", location: "Downtown Store", weeklyHours: 24 },
  { key: "ibrahim-yusuf", name: "Ibrahim Yusuf", role: "EMPLOYEE", position: "Inventory Specialist", location: "Warehouse", weeklyHours: 32 },
  { key: "mia-hernandez", name: "Mia Hernandez", role: "EMPLOYEE", position: "Inventory Specialist", location: "Warehouse", weeklyHours: 32 },
  { key: "noah-sinclair", name: "Noah Sinclair", role: "EMPLOYEE", position: "Inventory Specialist", location: "Warehouse", weeklyHours: 24 },
  { key: "aisha-rahman", name: "Aisha Rahman", role: "EMPLOYEE", position: "Customer Support Agent", location: "Customer Support Hub", weeklyHours: 32 },
  { key: "ethan-park", name: "Ethan Park", role: "EMPLOYEE", position: "Customer Support Agent", location: "Customer Support Hub", weeklyHours: 32 },
  { key: "olivia-chen", name: "Olivia Chen", role: "EMPLOYEE", position: "Customer Support Agent", location: "Customer Support Hub", weeklyHours: 24 },
  { key: "marcus-johnson", name: "Marcus Johnson", role: "EMPLOYEE", position: "Operations Coordinator", location: "Warehouse", weeklyHours: 32 },
  { key: "sofia-patel", name: "Sofia Patel", role: "EMPLOYEE", position: "Customer Support Agent", location: "Customer Support Hub", weeklyHours: 24 },
] as const;

export type DemoShiftFixture = {
  offset: number;
  location: string;
  position: string;
  employeeKey: string | null;
  start: string;
  end: string;
  openForClaim: boolean;
  breakMinutes: number;
};

export function demoWeekFixtures(): DemoShiftFixture[] {
  const shifts: DemoShiftFixture[] = [];
  const sales = ["daniel-brooks", "fatima-bello", "chloe-martin"];
  const inventory = ["ibrahim-yusuf", "mia-hernandez", "noah-sinclair"];
  const support = ["aisha-rahman", "ethan-park", "olivia-chen", "sofia-patel"];
  for (let day = 0; day < 7; day++) {
    const salesOpen = day === 5;
    const warehouseOpen = day === 2;
    const supportOpen = day === 4;
    const add = (
      location: string, position: string, employeeKey: string | null,
      start: string, end: string,
    ) => {
      shifts.push({ offset: day, location, position, employeeKey, start, end,
        openForClaim: !employeeKey, breakMinutes: 30 });
    };
    add("Downtown Store", "Sales Associate", salesOpen ? null : sales[day % sales.length], "09:00", "17:00");
    add("Warehouse", "Inventory Specialist", warehouseOpen ? null : inventory[day % inventory.length], "07:00", "15:00");
    add("Customer Support Hub", "Customer Support Agent", support[day % support.length], "09:00", "17:00");
    if (day < 5) {
      add("Customer Support Hub", "Customer Support Agent", supportOpen ? null : support[(day + 2) % support.length], "12:00", "20:00");
      if (day !== 1) add("Downtown Store", "Shift Supervisor", "jasmine-okafor", "10:00", "18:00");
      if (day !== 3) add("Warehouse", "Operations Coordinator", "marcus-johnson", "09:00", "17:00");
    }
  }
  return shifts;
}

/** Preview metadata for the owner before they opt into demo seeding. */
export function demoFixtureSummary() {
  return {
    syntheticStaff: DEMO_EMPLOYEES.length,
    locations: DEMO_LOCATIONS.length,
    positions: DEMO_POSITIONS.length,
    rosters: 2,
    shifts: demoWeekFixtures().length * 2,
  };
}
