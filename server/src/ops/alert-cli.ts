import { sendOpsAlert } from "./alert.js";

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

const subject = getArg("--subject");
const message = getArg("--message");

if (!subject || !message) {
  console.error("Missing --subject or --message for ops alert");
  process.exit(1);
}

sendOpsAlert(subject, message).catch((error) => {
  console.error("Failed to send ops alert", error);
  process.exit(1);
});
