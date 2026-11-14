/** Actions du compte client, envoyées à POST /api/me/action quand le client est connecté. */
import type { Appliance, MeterPhase } from "./engine";
import type { Meter, User } from "./demo";
import type { Cycle, Pack, PaymentMethod } from "./pricing";

export type MeterInput = Omit<Meter, "id">;

export type Action =
  | { type: "reading"; meterId: string; date: string; balanceKwh: number; monthKwh: number; yesterdayKwh: number }
  | { type: "recharge"; meterId: string; date: string; amount: number; vendor: string; tokens: string[]; kwh?: number }
  | { type: "meter.add"; meter: MeterInput }
  | { type: "meter.remove"; id: string }
  | { type: "meter.update"; id: string; patch: Partial<Pick<Meter, "name" | "usage" | "phase" | "debt" | "occupant">> }
  | { type: "appliance.add"; appliance: Omit<Appliance, "id"> }
  | { type: "appliance.remove"; id: string }
  | { type: "user.update"; patch: Partial<Omit<User, "phone" | "initials">> }
  | { type: "alerts.read" }
  | { type: "alert.dismiss"; id: string }
  | { type: "subscribe"; pack: Pack; cycle: Cycle; meters: number; method: PaymentMethod }
  | { type: "pack"; pack: Pack }
  | { type: "ia"; meterId: string; question: string; answer: string };

export type { MeterPhase };
