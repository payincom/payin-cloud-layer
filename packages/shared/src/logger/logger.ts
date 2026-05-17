/**
 * Lightweight logger implementation for PayIn
 */

import { LogLevel, LogCategory, Logger, LoggerConfig } from './types.js'

const hasProcessEnv = typeof process !== 'undefined' && typeof process.env !== 'undefined'

/**
 * Global logger configuration
 */
class LoggerManager {
  private currentLevel: LogLevel = LogLevel.INFO
  private allowedCategories: Set<LogCategory> = new Set()
  private enableColors: boolean = true
  private enableTimestamp: boolean = true

  constructor() {
    this.loadFromEnvironment()
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Parse LOG_LEVEL
    const levelEnv = hasProcessEnv ? process.env.LOG_LEVEL : undefined
    if (levelEnv !== undefined) {
      const level = parseInt(levelEnv, 10)
      if (!isNaN(level) && level >= LogLevel.SILENT && level <= LogLevel.VERBOSE) {
        this.currentLevel = level
      }
    }

    // Parse LOG_CATEGORIES
    const categoriesEnv = hasProcessEnv ? process.env.LOG_CATEGORIES : undefined
    if (categoriesEnv) {
      const categories = categoriesEnv.split(',').map(c => c.trim() as LogCategory)
      this.allowedCategories = new Set(categories)
    } else {
      // Default to all categories if not specified
      this.allowedCategories = new Set(Object.values(LogCategory))
    }

    // Parse other options
    this.enableColors = hasProcessEnv ? process.env.LOG_COLORS !== 'false' : true
    this.enableTimestamp = hasProcessEnv ? process.env.LOG_TIMESTAMP !== 'false' : true
  }

  /**
   * Configure logger programmatically
   */
  configure(config: LoggerConfig): void {
    if (config.level !== undefined) {
      this.currentLevel = config.level
    }
    if (config.categories !== undefined) {
      this.allowedCategories = new Set(config.categories)
    }
    if (config.enableColors !== undefined) {
      this.enableColors = config.enableColors
    }
    if (config.enableTimestamp !== undefined) {
      this.enableTimestamp = config.enableTimestamp
    }
  }

  /**
   * Reload configuration from environment variables
   */
  reloadFromEnvironment(): void {
    this.loadFromEnvironment()
  }

  /**
   * Check if a log message should be output
   */
  shouldLog(level: LogLevel, category: LogCategory): boolean {
    return level <= this.currentLevel && this.allowedCategories.has(category)
  }

  /**
   * Format log message
   */
  formatMessage(level: LogLevel, category: LogCategory, message: string): string {
    const parts: string[] = []

    // Timestamp
    if (this.enableTimestamp) {
      const timestamp = new Date().toISOString().substr(11, 12) // HH:mm:ss.SSS
      parts.push(`[${timestamp}]`)
    }

    // Level indicator with emoji and color
    if (this.enableColors) {
      const levelInfo = this.getLevelInfo(level)
      parts.push(`${levelInfo.emoji} ${levelInfo.name}`)
    } else {
      parts.push(`[${LogLevel[level]}]`)
    }

    // Category
    parts.push(`[${category.toUpperCase()}]`)

    // Message
    parts.push(message)

    return parts.join(' ')
  }

  /**
   * Get level display information
   */
  private getLevelInfo(level: LogLevel): { emoji: string; name: string } {
    switch (level) {
      case LogLevel.ERROR:
        return { emoji: '❌', name: 'ERROR' }
      case LogLevel.WARN:
        return { emoji: '⚠️', name: 'WARN ' }
      case LogLevel.INFO:
        return { emoji: 'ℹ️', name: 'INFO ' }
      case LogLevel.DEBUG:
        return { emoji: '🔍', name: 'DEBUG' }
      case LogLevel.VERBOSE:
        return { emoji: '📝', name: 'VERB ' }
      default:
        return { emoji: '📋', name: 'LOG  ' }
    }
  }

  /**
   * Output log message
   */
  log(level: LogLevel, category: LogCategory, message: string, ...args: any[]): void {
    if (!this.shouldLog(level, category)) {
      return
    }

    const formattedMessage = this.formatMessage(level, category, message)

    if (level === LogLevel.ERROR) {
      console.error(formattedMessage, ...args)
    } else if (level === LogLevel.WARN) {
      console.warn(formattedMessage, ...args)
    } else {
      console.log(formattedMessage, ...args)
    }
  }
}

/**
 * Global logger manager instance
 */
const loggerManager = new LoggerManager()

/**
 * Logger implementation for a specific category
 */
class CategoryLogger implements Logger {
  constructor(private category: LogCategory) {}

  error(message: string, ...args: any[]): void {
    loggerManager.log(LogLevel.ERROR, this.category, message, ...args)
  }

  warn(message: string, ...args: any[]): void {
    loggerManager.log(LogLevel.WARN, this.category, message, ...args)
  }

  info(message: string, ...args: any[]): void {
    loggerManager.log(LogLevel.INFO, this.category, message, ...args)
  }

  debug(message: string, ...args: any[]): void {
    loggerManager.log(LogLevel.DEBUG, this.category, message, ...args)
  }

  verbose(message: string, ...args: any[]): void {
    loggerManager.log(LogLevel.VERBOSE, this.category, message, ...args)
  }
}

/**
 * Create a logger for a specific category
 */
export function createLogger(category: LogCategory): Logger {
  return new CategoryLogger(category)
}

/**
 * Configure global logger settings
 */
export function configureLogger(config: LoggerConfig): void {
  loggerManager.configure(config)
}

/**
 * Reload logger configuration from environment variables
 */
export function reloadLoggerFromEnvironment(): void {
  loggerManager.reloadFromEnvironment()
}

/**
 * Export types and enums for convenience
 */
export { LogLevel, LogCategory } from './types.js'
