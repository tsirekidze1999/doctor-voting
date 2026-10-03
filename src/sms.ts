import { URLSearchParams } from "node:url";
export function isConsoleSmsEnabled() { return process.env.NODE_ENV === "development" && (process.env.SMS_PROVIDER ?? "console") === "console"; }
export function isUbillSmsEnabled() { return process.env.SMS_PROVIDER === "ubill" && Boolean(process.env.UBILL_API_KEY) && Boolean(process.env.UBILL_BRAND_ID); }
export function isSmsEnabled() { return isConsoleSmsEnabled() || isUbillSmsEnabled(); }
export async function sendSmsCode(phone: string, otp: string, label = "თქვენი MED VOTE ვერიფიკაციის კოდია: ") {
  if (isConsoleSmsEnabled()) { console.log("[TEST SMS]", JSON.stringify({ phone, otp })); return { delivery: "console" as const }; }
  if (!isUbillSmsEnabled()) throw new Error("SMS provider is not configured");
  const params = new URLSearchParams({ key: process.env.UBILL_API_KEY! });
  const response = await fetch("https://api.ubill.dev/v1/sms/send?" + params.toString(), { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ brandID: Number(process.env.UBILL_BRAND_ID), numbers: [Number(phone.replace(/^\+/, ""))], text: label + otp, stopList: true, otp: true }), cache: "no-store", signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => null) as { statusID?: number; message?: string } | null;
  if (!response.ok || (body?.statusID !== undefined && ![0, 1].includes(body.statusID))) throw new Error(body?.message || "UBill SMS failed");
  return { delivery: "ubill" as const };
}

