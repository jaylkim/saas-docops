import { detectObsidianVaults, getVaultSummary, isPluginEnabled } from "./vault-detector";
import type { VaultInfo } from "./vault-detector";
import { installToVault, uninstallFromVault, getInstalledVersion } from "./vault-installer";
import type { InstallResult } from "./vault-installer";

export type { VaultInfo, InstallResult };

/**
 * VaultManager - Manages plugin installation across multiple Obsidian vaults
 */
export class VaultManager {
  private currentVaultPath: string;
  private sourcePluginDir: string;

  constructor(currentVaultPath: string, sourcePluginDir: string) {
    this.currentVaultPath = currentVaultPath;
    this.sourcePluginDir = sourcePluginDir;
  }

  /**
   * Get all detected Obsidian vaults with installation status
   */
  async getVaults(): Promise<VaultInfo[]> {
    return detectObsidianVaults(this.currentVaultPath);
  }

  /**
   * Get summary of vault installation status
   */
  async getSummary(): Promise<{ total: number; installed: number; notInstalled: number }> {
    return getVaultSummary(this.currentVaultPath);
  }

  /**
   * Install plugin to a specific vault
   */
  async installToVault(targetVaultPath: string): Promise<InstallResult> {
    return installToVault(this.sourcePluginDir, targetVaultPath);
  }

  /**
   * Install plugin to all detected vaults that don't have it installed
   */
  async installToAllVaults(): Promise<{ succeeded: string[]; failed: { path: string; error: string }[] }> {
    const vaults = await this.getVaults();
    const succeeded: string[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const vault of vaults) {
      if (vault.isCurrent) {
        // Skip current vault (already installed)
        succeeded.push(vault.path);
        continue;
      }

      const result = await this.installToVault(vault.path);
      if (result.success) {
        succeeded.push(vault.path);
      } else {
        failed.push({ path: vault.path, error: result.error || "Unknown error" });
      }
    }

    return { succeeded, failed };
  }

  /**
   * Update plugin in all installed vaults
   */
  async syncAllVaults(): Promise<{ updated: string[]; skipped: string[]; failed: { path: string; error: string }[] }> {
    const vaults = await this.getVaults();
    const updated: string[] = [];
    const skipped: string[] = [];
    const failed: { path: string; error: string }[] = [];

    const currentVersion = this.getCurrentVersion();

    for (const vault of vaults) {
      if (!vault.isInstalled) {
        skipped.push(vault.path);
        continue;
      }

      if (vault.isCurrent) {
        // Skip current vault
        skipped.push(vault.path);
        continue;
      }

      // Check if update is needed
      if (vault.installedVersion === currentVersion) {
        skipped.push(vault.path);
        continue;
      }

      const result = await this.installToVault(vault.path);
      if (result.success) {
        updated.push(vault.path);
      } else {
        failed.push({ path: vault.path, error: result.error || "Unknown error" });
      }
    }

    return { updated, skipped, failed };
  }

  /**
   * Uninstall plugin from a vault
   */
  async uninstallFromVault(vaultPath: string): Promise<InstallResult> {
    return uninstallFromVault(vaultPath);
  }

  /**
   * Check if plugin is enabled in a vault
   */
  isPluginEnabled(vaultPath: string): boolean {
    return isPluginEnabled(vaultPath);
  }

  /**
   * Get installed version in a specific vault
   */
  getInstalledVersion(vaultPath: string): string | null {
    return getInstalledVersion(vaultPath);
  }

  /**
   * Get the current plugin version (from source)
   */
  getCurrentVersion(): string | null {
    return getInstalledVersion(this.currentVaultPath);
  }
}

export default VaultManager;
