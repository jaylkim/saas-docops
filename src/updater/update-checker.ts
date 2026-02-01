/**
 * SaaS DocOps - Update Checker Module
 *
 * Checks for updates from GitHub Releases and provides update notifications.
 */

// GitHub repository configuration
const REPO_OWNER = "jaylkim";
const REPO_NAME = "saas-docops";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

// Cache duration: 1 hour
const CACHE_DURATION_MS = 60 * 60 * 1000;

export interface ReleaseInfo {
  version: string;
  tagName: string;
  htmlUrl: string;
  publishedAt: string;
  body: string;
  downloadUrls: {
    arm64?: string;
    x64?: string;
  };
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseInfo?: ReleaseInfo;
  error?: string;
  checkedAt: number;
}

// Simple cache for update check results
let cachedResult: UpdateCheckResult | null = null;

/**
 * Parse version string to comparable parts
 * Handles: v0.1.0, 0.1.0, v0.1.0-alpha.1, etc.
 */
function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease: string } {
  // Remove 'v' prefix if present
  const cleaned = version.replace(/^v/, "");

  // Split version and prerelease
  const [versionPart, prerelease = ""] = cleaned.split("-");
  const [major = 0, minor = 0, patch = 0] = versionPart.split(".").map(Number);

  return { major, minor, patch, prerelease };
}

/**
 * Compare two version strings
 * Returns:
 *  -1 if v1 < v2
 *   0 if v1 == v2
 *   1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);

  // Compare major.minor.patch
  if (parsed1.major !== parsed2.major) {
    return parsed1.major > parsed2.major ? 1 : -1;
  }
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor > parsed2.minor ? 1 : -1;
  }
  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch > parsed2.patch ? 1 : -1;
  }

  // Handle prerelease (no prerelease > prerelease)
  if (!parsed1.prerelease && parsed2.prerelease) {
    return 1; // v1 is stable, v2 is prerelease
  }
  if (parsed1.prerelease && !parsed2.prerelease) {
    return -1; // v1 is prerelease, v2 is stable
  }
  if (parsed1.prerelease && parsed2.prerelease) {
    // Compare prerelease strings lexicographically
    return parsed1.prerelease.localeCompare(parsed2.prerelease);
  }

  return 0;
}

/**
 * Detect current platform
 */
function detectPlatform(): "arm64" | "x64" {
  // In Electron/Node.js environment
  if (typeof process !== "undefined" && process.arch) {
    return process.arch === "arm64" ? "arm64" : "x64";
  }
  // Default fallback
  return "arm64";
}

/**
 * Fetch latest release info from GitHub
 */
async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const response = await fetch(GITHUB_API_URL, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SaaS-DocOps-Update-Checker",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("No releases found");
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate limit exceeded");
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  // Parse assets to find download URLs
  const downloadUrls: ReleaseInfo["downloadUrls"] = {};

  for (const asset of data.assets || []) {
    const name = asset.name as string;
    if (name.includes("darwin-arm64") && name.endsWith(".zip")) {
      downloadUrls.arm64 = asset.browser_download_url;
    } else if (name.includes("darwin-x64") && name.endsWith(".zip")) {
      downloadUrls.x64 = asset.browser_download_url;
    }
  }

  return {
    version: data.tag_name?.replace(/^v/, "") || "unknown",
    tagName: data.tag_name || "",
    htmlUrl: data.html_url || "",
    publishedAt: data.published_at || "",
    body: data.body || "",
    downloadUrls,
  };
}

/**
 * Check for updates
 *
 * @param currentVersion Current plugin version (from manifest.json)
 * @param forceCheck Skip cache and force fresh check
 */
export async function checkForUpdates(
  currentVersion: string,
  forceCheck = false
): Promise<UpdateCheckResult> {
  // Check cache
  if (!forceCheck && cachedResult) {
    const cacheAge = Date.now() - cachedResult.checkedAt;
    if (cacheAge < CACHE_DURATION_MS) {
      // Update currentVersion in case it changed
      cachedResult.currentVersion = currentVersion;
      if (cachedResult.latestVersion) {
        cachedResult.hasUpdate = compareVersions(cachedResult.latestVersion, currentVersion) > 0;
      }
      return cachedResult;
    }
  }

  try {
    const releaseInfo = await fetchLatestRelease();

    const hasUpdate = compareVersions(releaseInfo.version, currentVersion) > 0;

    cachedResult = {
      hasUpdate,
      currentVersion,
      latestVersion: releaseInfo.version,
      releaseInfo,
      checkedAt: Date.now(),
    };

    return cachedResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    cachedResult = {
      hasUpdate: false,
      currentVersion,
      error: errorMessage,
      checkedAt: Date.now(),
    };

    return cachedResult;
  }
}

/**
 * Clear the update check cache
 */
export function clearUpdateCache(): void {
  cachedResult = null;
}

/**
 * Get the installation command for the current platform
 */
export function getInstallCommand(): string {
  return `curl -sSL https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/install.sh | bash`;
}

/**
 * Get the download URL for the current platform
 */
export function getDownloadUrl(releaseInfo: ReleaseInfo): string | undefined {
  const platform = detectPlatform();
  return platform === "arm64" ? releaseInfo.downloadUrls.arm64 : releaseInfo.downloadUrls.x64;
}

/**
 * Get GitHub releases page URL
 */
export function getReleasesPageUrl(): string {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
}

/**
 * Format release date for display
 */
export function formatReleaseDate(isoDate: string): string {
  if (!isoDate) return "";

  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
