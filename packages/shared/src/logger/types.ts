/**
 * Logger types and interfaces
 */

/**
 * Log levels in ascending order of importance
 */
export enum LogLevel {
  SILENT = 0,  // No output
  ERROR = 1,   // Error conditions
  WARN = 2,    // Warning conditions
  INFO = 3,    // Informational messages
  DEBUG = 4,   // Debug-level messages
  VERBOSE = 5  // Verbose debug information
}

/**
 * Log categories for filtering
 */
export enum LogCategory {
  SYSTEM = 'system',
  MONITOR = 'monitor',
  DATABASE = 'database',
  RPC = 'rpc',
  TEST = 'test',
  PROCESSOR = 'processor',
  NOTIFICATION = 'notification'
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level?: LogLevel
  categories?: LogCategory[]
  enableColors?: boolean
  enableTimestamp?: boolean
}

/**
 * Logger instance interface
 */
export interface Logger {
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
  verbose(message: string, ...args: any[]): void
}