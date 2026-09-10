export const PAYMENT_SETTINGS_KEY = "captain-gai-sod-payment-settings";
export const PAYMENT_SETTINGS_CHANGED_EVENT = "payment-settings-changed";

export type PaymentSettings = {
  promptPayEnabled: boolean;
  promptPayId: string;
  merchantName: string;
  merchantCity: string;
};

export const defaultPaymentSettings: PaymentSettings = {
  promptPayEnabled: true,
  // Demo value for local development. Replace this with the shop's PromptPay number in Settings.
  promptPayId: "1309903234088 ",
  merchantName: "CAPTAIN GAI SOD",
  merchantCity: "BANGKOK",
};

export function loadPaymentSettings(): PaymentSettings {
  if (typeof window === "undefined") return defaultPaymentSettings;

  try {
    const stored = window.localStorage.getItem(PAYMENT_SETTINGS_KEY);
    if (!stored) return defaultPaymentSettings;
    const parsed = JSON.parse(stored) as Partial<PaymentSettings>;
    return {
      ...defaultPaymentSettings,
      ...parsed,
      promptPayEnabled: parsed.promptPayEnabled !== false,
    };
  } catch {
    return defaultPaymentSettings;
  }
}

export function savePaymentSettings(settings: PaymentSettings) {
  window.localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(PAYMENT_SETTINGS_CHANGED_EVENT));
}

function encodeField(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function normalizePromptPayId(promptPayId: string) {
  const digits = promptPayId.replace(/\D/g, "");
  if (digits.length === 13) return { tag: "02", value: digits };
  if (digits.length === 10 && digits.startsWith("0")) return { tag: "01", value: `0066${digits.slice(1)}` };
  throw new Error("หมายเลข PromptPay ต้องเป็นเบอร์โทรศัพท์ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก");
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPromptPayPayload({
  promptPayId,
  amount,
  merchantName,
  merchantCity,
}: Pick<PaymentSettings, "promptPayId" | "merchantName" | "merchantCity"> & { amount: number }) {
  const account = normalizePromptPayId(promptPayId);
  const merchantAccount = [
    encodeField("00", "A000000677010111"),
    encodeField(account.tag, account.value),
  ].join("");
  const amountValue = amount.toFixed(2);
  const body = [
    encodeField("00", "01"),
    encodeField("01", "12"),
    encodeField("29", merchantAccount),
    encodeField("52", "0000"),
    encodeField("53", "764"),
    encodeField("54", amountValue),
    encodeField("58", "TH"),
    encodeField("59", merchantName.trim().slice(0, 25) || defaultPaymentSettings.merchantName),
    encodeField("60", merchantCity.trim().slice(0, 15) || defaultPaymentSettings.merchantCity),
  ].join("");

  return `${body}6304${crc16(`${body}6304`)}`;
}
