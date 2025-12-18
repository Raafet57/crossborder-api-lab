import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

function idkDir(): string {
  return path.resolve(__dirname, "..", ".idk");
}

function idkFile(command: string): string {
  return path.join(idkDir(), `${command}.txt`);
}

export async function getOrCreateIdempotencyKey(
  command: string,
): Promise<string> {
  const filePath = idkFile(command);
  try {
    const existing = await fs.readFile(filePath, "utf8");
    const key = existing.trim();
    if (key) return key;
  } catch {
    // ignore
  }

  const key = randomUUID();
  await fs.mkdir(idkDir(), { recursive: true });
  await fs.writeFile(filePath, `${key}\n`, "utf8");
  return key;
}
