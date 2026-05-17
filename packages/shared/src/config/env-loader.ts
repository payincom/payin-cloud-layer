import { isAbsolute, resolve } from 'path';
import { existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';

export interface LoadEnvOptions {
  /**
   * Base directory used to resolve relative paths.
   * Defaults to process.cwd().
   */
  rootDir?: string;
  /**
   * List of env files to load in order. Relative paths are resolved against rootDir.
   */
  files?: readonly string[];
  /**
   * When true, variables in the loaded files override existing process.env values.
   * Defaults to false (first loaded file wins).
   */
  override?: boolean;
  /**
   * Skip logging for missing files (default true).
   */
  silent?: boolean;
}

export interface LoadEnvResult {
  loaded: string[];
  skipped: string[];
}

/**
 * Load one or more .env files with deterministic ordering.
 * Missing files are ignored by default.
 */
export function loadEnvFiles(options: LoadEnvOptions = {}): LoadEnvResult {
  const {
    rootDir = process.cwd(),
    files = ['.env'],
    override = false,
    silent = true
  } = options;

  const loaded: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const absolutePath = isAbsolute(file) ? file : resolve(rootDir, file);

    if (!existsSync(absolutePath)) {
      skipped.push(absolutePath);
      if (!silent) {
        console.warn(`[env-loader] Skipping missing env file: ${absolutePath}`);
      }
      continue;
    }

    const result = dotenvConfig({ path: absolutePath, override });
    if (result.error) {
      throw result.error;
    }

    loaded.push(absolutePath);
  }

  return { loaded, skipped };
}

/**
 * Convenience helper that loads the repository root .env followed by optional additional files.
 */
export function loadRootEnv(additionalFiles: readonly string[] = [], options: Omit<LoadEnvOptions, 'files'> = {}): LoadEnvResult {
  const { rootDir = process.cwd(), override = false, silent = true } = options;

  const combinedFiles = ['../../.env', ...additionalFiles];
  return loadEnvFiles({
    rootDir,
    files: combinedFiles,
    override,
    silent
  });
}
