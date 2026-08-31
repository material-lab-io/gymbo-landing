#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const SEED_RECIPIENT = "nyx@materiallab.io";
export const SEED_CONFIRMATION = "SEND_SEED_TO_NYX_ONLY";
export const SEED_SENDER = "Gymbo <hello@updates.getgymbo.com>";
export const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

const HTML_TEMPLATE = new URL("../ops/email/resend-seed.html", import.meta.url);
const TEXT_TEMPLATE = new URL("../ops/email/resend-seed.txt", import.meta.url);

function formatCoverageDate(now) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
    .format(now)
    .replace(",", "");
}

function formatGeneratedAt(now) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(now);
  return `${parts} IST`;
}

function fillTemplate(template, now) {
  return template
    .replaceAll("{{COVERAGE_DATE}}", formatCoverageDate(now))
    .replaceAll("{{GENERATED_AT}}", formatGeneratedAt(now));
}

export async function buildSeedPayload(now = new Date()) {
  const [htmlTemplate, textTemplate] = await Promise.all([
    readFile(HTML_TEMPLATE, "utf8"),
    readFile(TEXT_TEMPLATE, "utf8"),
  ]);
  const coverageDate = formatCoverageDate(now);

  return {
    from: SEED_SENDER,
    to: [SEED_RECIPIENT],
    reply_to: SEED_RECIPIENT,
    subject: `Gymbo: outbound email capability seed — ${coverageDate}`,
    html: fillTemplate(htmlTemplate, now),
    text: fillTemplate(textTemplate, now),
  };
}

export function validateSendEnvironment(env = process.env) {
  if (env.GYMBO_EMAIL_SEED_CONFIRM !== SEED_CONFIRMATION) {
    throw new Error(
      `Refusing to send: set GYMBO_EMAIL_SEED_CONFIRM=${SEED_CONFIRMATION}`,
    );
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("re_")) {
    throw new Error("Refusing to send: RESEND_API_KEY is missing or malformed");
  }

  return { apiKey };
}

export async function sendSeed({ env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const { apiKey } = validateSendEnvironment(env);
  const payload = await buildSeedPayload(now);
  const response = await fetchImpl(RESEND_EMAILS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "gymbo-gtm-outbound-capability-seed-v1",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Resend rejected the seed (${response.status}): ${responseText}`);
  }

  const result = JSON.parse(responseText);
  return { id: result.id, recipient: SEED_RECIPIENT };
}

async function main() {
  if (!process.argv.includes("--send")) {
    const payload = await buildSeedPayload();
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          endpoint: RESEND_EMAILS_ENDPOINT,
          payload,
          note: `Pass --send and set GYMBO_EMAIL_SEED_CONFIRM=${SEED_CONFIRMATION} to deliver only to ${SEED_RECIPIENT}.`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await sendSeed();
  console.log(`Seed accepted by Resend: ${result.id} → ${result.recipient}`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
