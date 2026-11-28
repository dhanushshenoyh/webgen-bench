import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const require = createRequire(import.meta.url);

export type ValidatorMessage = { type: string; subType?: string; message: string; page: string; line?: number };
export type ValidatorResult = { validator: string; errors: number; warnings: number; messages: ValidatorMessage[] };

/** Runs the official W3C Nu HTML Checker (vnu.jar) offline on every page. */
export async function runValidator(dir: string, pages: string[]): Promise<ValidatorResult> {
  const jar = String(require("vnu-jar"));
  const { stderr } = await run("java", ["-jar", jar, "--format", "json", "--exit-zero-always", ...pages.map((page) => (page.startsWith("/") ? page : join(dir, page)))], { maxBuffer: 32 * 1024 * 1024 });
  const parsed = JSON.parse(stderr || "{\"messages\":[]}") as { messages: { type: string; subType?: string; message: string; url?: string; lastLine?: number }[] };
  const messages = parsed.messages.map((item) => ({ type: item.type, subType: item.subType, message: item.message, page: (item.url ?? "").split("/").pop() ?? "", line: item.lastLine }));
  const { stdout } = await run("java", ["-jar", jar, "--version"]);
  return {
    validator: `W3C Nu HTML Checker ${stdout.trim()}`,
    errors: messages.filter((item) => item.type === "error").length,
    warnings: messages.filter((item) => item.type === "info" && item.subType === "warning").length,
    messages,
  };
}
