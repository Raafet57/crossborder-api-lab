import { promises as fs } from "fs";
import path from "path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonFile(
  inputPath: string,
): Promise<Record<string, unknown>> {
  const attemptedPaths: string[] = [];

  const tryRead = async (candidate: string) => {
    attemptedPaths.push(candidate);
    const raw = await fs.readFile(candidate, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      throw new Error(`JSON at ${candidate} must be an object`);
    }
    return parsed;
  };

  if (path.isAbsolute(inputPath)) {
    return tryRead(inputPath);
  }

  try {
    return await tryRead(path.resolve(process.cwd(), inputPath));
  } catch (err) {
    const fallback = path.resolve(__dirname, "..", inputPath);
    try {
      return await tryRead(fallback);
    } catch {
      const error = err instanceof Error ? err : new Error(String(err));
      error.message = `${error.message}\nTried:\n${attemptedPaths
        .map((p) => `- ${p}`)
        .join("\n")}`;
      throw error;
    }
  }
}
