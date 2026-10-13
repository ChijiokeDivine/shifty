/**
 * Unit demand forecast from historical census + calendar features.
 * Aggregate counts only — never a patient roster.
 */

import type { ShiftWindow } from "@/lib/shiftii/types";
import { isWeekend, weekdayIso } from "@/lib/shiftii/time";

export type CensusPoint = {
  date: string;
  locationId: string;
  shiftWindow: string;
  patientCount: number;
  averageAcuity: number | null;
};

export type ForecastInput = {
  date: string;
  locationId: string;
  shiftWindow: ShiftWindow;
  history: CensusPoint[];
  /** Baseline RN/CNA ratio used when history is thin. */
  baselineHeadcount: number;
};

export type ForecastResult = {
  predictedHeadcount: number;
  expectedPatients: number;
  expectedAcuity: number;
  method: "history+calendar" | "baseline";
};

export function forecastHeadcount(input: ForecastInput): ForecastResult {
  const hist = input.history.filter(
    (h) => h.locationId === input.locationId && h.shiftWindow === input.shiftWindow,
  );
  if (hist.length < 3) {
    return {
      predictedHeadcount: input.baselineHeadcount,
      expectedPatients: 0,
      expectedAcuity: 3,
      method: "baseline",
    };
  }

  const sameDow = hist.filter((h) => weekdayIso(h.date) === weekdayIso(input.date));
  const pool = sameDow.length >= 2 ? sameDow : hist;
  const patients = avg(pool.map((h) => h.patientCount));
  const acuity = avg(pool.map((h) => h.averageAcuity ?? 3));

  // Weekend ED/ICU bump, night slightly leaner except ICU.
  let weekend = 1;
  if (isWeekend(input.date)) weekend = 1.08;
  const nightAdj = input.shiftWindow === "NIGHT" ? 0.95 : 1;

  // Staffing function: roughly 1 RN per 2.1 patients at acuity 3, scaled.
  const acuityFactor = 0.75 + (acuity / 5) * 0.7;
  const raw = (patients / 2.15) * acuityFactor * weekend * nightAdj;
  const predicted = Math.max(input.baselineHeadcount, Math.round(raw));

  return {
    predictedHeadcount: predicted,
    expectedPatients: Math.round(patients * 10) / 10,
    expectedAcuity: Math.round(acuity * 10) / 10,
    method: "history+calendar",
  };
}

function avg(ns: number[]): number {
  if (!ns.length) return 0;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}
