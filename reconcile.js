// Payment reconciliation.
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js

const fs = require("fs");

// Convert an amount to integer kobo so the sum has no floating point drift.
function toKobo(value) {
  const cleaned = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const naira = Number(cleaned);
  if (cleaned === "" || cleaned === null || !Number.isFinite(naira)) {
    throw new Error(`Unparseable amount: ${JSON.stringify(value)}`);
  }
  return Math.round(naira * 100);
}

const latestByTxn = new Map(); // txn_id -> { time, order, event }
let order = 0;

for (const rawLine of fs.readFileSync("payments.jsonl", "utf8").split(/\r?\n/)) {
  order += 1;
  if (!rawLine.trim()) continue;

  let event;
  try {
    event = JSON.parse(rawLine);
  } catch (error) {
    continue;
  }

  if (event === null || typeof event !== "object" || Array.isArray(event)) continue;
  if (event.txn_id === undefined || event.txn_id === null || String(event.txn_id).trim() === "") continue;

  const time = Date.parse(event.ts);
  if (Number.isNaN(time)) continue; 

  const current = latestByTxn.get(event.txn_id);
  if (!current || time > current.time || (time === current.time && order > current.order)) {
    latestByTxn.set(event.txn_id, { time, order, event });
  }
}

let totalKobo = 0;
let count = 0;

for (const { event } of latestByTxn.values()) {
  if (event.status === "success") {
    totalKobo += toKobo(event.amount);
    count += 1;
  }
}

const total = totalKobo / 100;
const expected = parseInt(fs.readFileSync("expected.txt", "utf8").trim(), 10);

if (count !== expected) {
  console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
  console.log("Something in the data isn't being handled the way the README describes.");
} else {
  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Your code: KOYA-${Math.round(total)}`);
}