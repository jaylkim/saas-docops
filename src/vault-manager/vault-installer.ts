import * as fs from "fs";
import * as path from "path";

const PLUGIN_ID = "saas-docops";

export interface InstallResult {
  success: boolean;
  error?: string;
  installedVersion?: string;
}

/**
 * Files required for plugin installation
 */
const REQUIRED_FILES = ["main.js", "manifest.json", "styles.css"];

/**
 * Install plugin to a target vault by copying from source plugin directory
 */
export async function installToVault(
  sourcePluginDir: string,
  targetVaultPath: string
): Promise<InstallResult> {
  try {
    // Validate source directory
    if (!fs.existsSync(sourcePluginDir)) {
      return { success: false, error: "Source plugin directory not found" };
    }

    // Check required files exist in source
    for (const file of REQUIRED_FILES) {
      const filePath = path.join(sourcePluginDir, file);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Missing required file: ${file}` };
      }
    }

    // Create target plugin directory
    const targetPluginDir = path.join(targetVaultPath, ".obsidian", "plugins", PLUGIN_ID);
    await ensureDir(targetPluginDir);

    // Copy main plugin files
    for (const file of REQUIRED_FILES) {
      const src = path.join(sourcePluginDir, file);
      const dst = path.join(targetPluginDir, file);
      fs.copyFileSync(src, dst);
    }

    // Copy node-pty if exists (required for terminal functionality)
    const nodePtySource = path.join(sourcePluginDir, "node_modules", "node-pty");
    if (fs.existsSync(nodePtySource)) {
      const nodePtyTarget = path.join(targetPluginDir, "node_modules", "node-pty");
      await copyDir(nodePtySource, nodePtyTarget);
    }

    // Copy data.json if exists (user settings)
    const dataJsonSource = path.join(sourcePluginDir, "data.json");
    if (fs.existsSync(dataJsonSource)) {
      const dataJsonTarget = path.join(targetPluginDir, "data.json");
      // Only copy if target doesn't exist (preserve user settings)
      if (!fs.existsSync(dataJsonTarget)) {
        fs.copyFileSync(dataJsonSource, dataJsonTarget);
      }
    }

    // Enable plugin in community-plugins.json
    await enablePlugin(targetVaultPath);

    // Get installed version
    const manifestPath = path.join(targetPluginDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    return {
      success: true,
      installedVersion: manifest.version,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[VaultInstaller] Installation failed:", e);
    return { success: false, error: errorMessage };
  }
}

/**
 * Enable the plugin in community-plugins.json
 */
async function enablePlugin(vaultPath: string): Promise<void> {
  const configPath = path.join(vaultPath, ".obsidian", "community-plugins.json");

  let plugins: string[] = [];

  if (fs.existsSync(configPath)) {
    try {
      plugins = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (!Array.isArray(plugins)) {
        plugins = [];
      }
    } catch {
      plugins = [];
    }
  }

  if (!plugins.includes(PLUGIN_ID)) {
    plugins.push(PLUGIN_ID);
    // Ensure .obsidian directory exists
    await ensureDir(path.join(vaultPath, ".obsidian"));
    fs.writeFileSync(configPath, JSON.stringify(plugins, null, 2));
  }
}

/**
 * Uninstall plugin from a vault
 */
export async function uninstallFromVault(vaultPath: string): Promise<InstallResult> {
  try {
    const pluginDir = path.join(vaultPath, ".obsidian", "plugins", PLUGIN_ID);

    if (!fs.existsSync(pluginDir)) {
      return { success: true }; // Already uninstalled
    }

    // Remove plugin directory
    fs.rmSync(pluginDir, { recursive: true, force: true });

    // Remove from community-plugins.json
    await disablePlugin(vaultPath);

    return { success: true };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Disable the plugin in community-plugins.json
 */
async function disablePlugin(vaultPath: string): Promise<void> {
  const configPath = path.join(vaultPath, ".obsidian", "community-plugins.json");

  if (!fs.existsSync(configPath)) {
    return;
  }

  try {
    let plugins: string[] = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    plugins = plugins.filter((p) => p !== PLUGIN_ID);
    fs.writeFileSync(configPath, JSON.stringify(plugins, null, 2));
  } catch {
    // Ignore errors
  }
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Recursively copy directory
 */
async function copyDir(src: string, dst: string): Promise<void> {
  await ensureDir(dst);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

/**
 * Get plugin version from a vault
 */
export function getInstalledVersion(vaultPath: string): string | null {
  const manifestPath = path.join(vaultPath, ".obsidian", "plugins", PLUGIN_ID, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    return manifest.version || null;
  } catch {
    return null;
  }
}
