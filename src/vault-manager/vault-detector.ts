import * as os from "os";
import * as path from "path";
import * as fs from "fs";

const PLUGIN_ID = "saas-docops";

export interface VaultInfo {
  path: string;
  name: string;
  isInstalled: boolean;
  isCurrent: boolean;
  installedVersion?: string;
}

interface ObsidianConfig {
  vaults: Record<string, { path?: string; open?: boolean }>;
}

/**
 * Detect all Obsidian vaults from the system configuration
 */
export async function detectObsidianVaults(currentVaultPath?: string): Promise<VaultInfo[]> {
  const configPath = getObsidianConfigPath();

  if (!fs.existsSync(configPath)) {
    console.warn("[VaultDetector] Obsidian config not found at:", configPath);
    return [];
  }

  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config: ObsidianConfig = JSON.parse(configContent);

    const vaults: VaultInfo[] = [];

    for (const vaultData of Object.values(config.vaults || {})) {
      const vaultPath = vaultData.path;
      if (!vaultPath || !fs.existsSync(vaultPath)) {
        continue;
      }

      const installInfo = getPluginInstallInfo(vaultPath);
      const isCurrent = currentVaultPath
        ? path.resolve(vaultPath) === path.resolve(currentVaultPath)
        : false;

      vaults.push({
        path: vaultPath,
        name: path.basename(vaultPath),
        isInstalled: installInfo.isInstalled,
        isCurrent,
        installedVersion: installInfo.version,
      });
    }

    // Sort: current vault first, then by name
    vaults.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.name.localeCompare(b.name);
    });

    return vaults;
  } catch (e) {
    console.error("[VaultDetector] Failed to parse Obsidian config:", e);
    return [];
  }
}

/**
 * Get the Obsidian config file path based on platform
 */
function getObsidianConfigPath(): string {
  const platform = process.platform;

  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "obsidian", "obsidian.json");
  } else if (platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", "obsidian", "obsidian.json");
  } else {
    // Linux
    return path.join(os.homedir(), ".config", "obsidian", "obsidian.json");
  }
}

/**
 * Check if plugin is installed in a vault and get version
 */
function getPluginInstallInfo(vaultPath: string): { isInstalled: boolean; version?: string } {
  const pluginDir = path.join(vaultPath, ".obsidian", "plugins", PLUGIN_ID);
  const manifestPath = path.join(pluginDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { isInstalled: false };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    return {
      isInstalled: true,
      version: manifest.version,
    };
  } catch {
    return { isInstalled: true };
  }
}

/**
 * Check if the plugin is enabled in a vault
 */
export function isPluginEnabled(vaultPath: string): boolean {
  const communityPluginsPath = path.join(vaultPath, ".obsidian", "community-plugins.json");

  if (!fs.existsSync(communityPluginsPath)) {
    return false;
  }

  try {
    const plugins: string[] = JSON.parse(fs.readFileSync(communityPluginsPath, "utf-8"));
    return plugins.includes(PLUGIN_ID);
  } catch {
    return false;
  }
}

/**
 * Get vault count summary
 */
export async function getVaultSummary(currentVaultPath?: string): Promise<{
  total: number;
  installed: number;
  notInstalled: number;
}> {
  const vaults = await detectObsidianVaults(currentVaultPath);
  const installed = vaults.filter((v) => v.isInstalled).length;

  return {
    total: vaults.length,
    installed,
    notInstalled: vaults.length - installed,
  };
}
