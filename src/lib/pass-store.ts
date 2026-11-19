import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const PASS_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface StoredPass {
  data: Buffer;
  fileName: string;
}

/** Short-lived pass storage. Swap the implementation for shared storage. */
export interface PassStore {
  save(pass: StoredPass): Promise<string>;
  read(token: string): Promise<StoredPass | null>;
  deleteExpired(): Promise<void>;
}

interface PassMetadata {
  fileName: string;
  expiresAt: number;
}

class TempFilePassStore implements PassStore {
  private readonly folder = path.join(tmpdir(), "towallet-passes");

  /** Files are named by hash, so the folder never reveals a working token. */
  private passPaths(id: string) {
    return {
      pass: path.join(this.folder, `${id}.pkpass`),
      metadata: path.join(this.folder, `${id}.json`),
    };
  }

  private async remove(id: string) {
    const paths = this.passPaths(id);
    await Promise.all([
      rm(paths.pass, { force: true }),
      rm(paths.metadata, { force: true }),
    ]);
  }

  async save({ data, fileName }: StoredPass): Promise<string> {
    await mkdir(this.folder, { recursive: true, mode: 0o700 });
    await this.deleteExpired();

    const token = randomBytes(32).toString("base64url");
    const id = hashToken(token);
    const paths = this.passPaths(id);
    const metadata: PassMetadata = {
      fileName,
      expiresAt: Date.now() + PASS_TOKEN_TTL_MS,
    };

    await writeFile(paths.pass, data, { mode: 0o600 });
    // Metadata lands last, so a token never points at a half-written pass.
    const pending = `${paths.metadata}.tmp`;
    await writeFile(pending, JSON.stringify(metadata), { mode: 0o600 });
    await rename(pending, paths.metadata);

    // Best effort only. Every save and read also removes expired files.
    setTimeout(() => {
      this.deleteExpired().catch(() => undefined);
    }, PASS_TOKEN_TTL_MS + 1000).unref();

    return token;
  }

  async read(token: string): Promise<StoredPass | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    await this.deleteExpired();

    const paths = this.passPaths(hashToken(token));
    try {
      const metadata = JSON.parse(
        await readFile(paths.metadata, "utf8"),
      ) as PassMetadata;
      if (metadata.expiresAt <= Date.now()) return null;
      return {
        data: await readFile(paths.pass),
        fileName: metadata.fileName,
      };
    } catch {
      return null;
    }
  }

  async deleteExpired(): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.folder);
    } catch {
      return;
    }

    const now = Date.now();
    await Promise.all(
      names.map(async (name) => {
        const id = name.split(".")[0];
        const file = path.join(this.folder, name);
        try {
          if (name.endsWith(".json")) {
            const metadata = JSON.parse(
              await readFile(file, "utf8"),
            ) as PassMetadata;
            if (metadata.expiresAt <= now) await this.remove(id);
            return;
          }
          // Clears anything left behind by an interrupted save.
          const { mtimeMs } = await stat(file);
          const hasMetadata = names.includes(`${id}.json`);
          if (!hasMetadata && mtimeMs + PASS_TOKEN_TTL_MS <= now) {
            await rm(file, { force: true });
          }
        } catch {
          await this.remove(id).catch(() => undefined);
        }
      }),
    );
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const store: PassStore = new TempFilePassStore();

export function getPassStore(): PassStore {
  return store;
}
