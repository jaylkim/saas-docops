/**
 * Terminal Module Exports
 */

export { TerminalView } from "./terminal-view";
export { PTYManager } from "./pty-manager";
export { SessionManager } from "./terminal-session";
export {
  getNodePty,
  checkABICompatibility,
  getDefaultShell,
  validateShell,
  getShellArgs,
  initElectronBridge,
} from "./electron-bridge";
export type { IPty, IPtyForkOptions, INodePty } from "./electron-bridge";
