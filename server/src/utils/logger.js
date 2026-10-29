const { createLogger, transports, format } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const fs = require("fs");
const { ElasticsearchTransport } = require("winston-elasticsearch");

const { combine, timestamp, json } = format;

// Jest sets JEST_WORKER_ID in every test worker process.
const isJest = process.env.JEST_WORKER_ID !== undefined;

// Ensure log directories exist before writing logs.
// Skipped under Jest because the workspace `logs/` tree is often root-owned
// (Docker), and creating DailyRotateFile against it throws an uncaught EACCES.
if (!isJest) {
  fs.mkdirSync("logs/info", { recursive: true });
  fs.mkdirSync("logs/error", { recursive: true });
}

/** Console transport used mainly for development and debugging. */
const consoleTransport = new transports.Console({
  level: "info",
  format: combine(timestamp(), json()),
});

/**
 * Create a daily-rotating file transport.
 *
 * @param {string} level - Log level (info, error, and so on).
 * @param {string} filename - Log file path pattern.
 * @returns {DailyRotateFile} Configured file transport.
 */
const fileTransport = (level, filename) =>
  new DailyRotateFile({
    level,
    format: combine(timestamp(), json()),
    filename,
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
  });

/**
 * Build the transport list.
 *
 * File and Elasticsearch transports are omitted under Jest so integration and
 * unit workers never open root-owned log files or leave Elasticsearch
 * connection-pool handles around.
 */
const loggerTransports = [consoleTransport];

if (!isJest) {
  loggerTransports.push(
    fileTransport("info", "logs/info/info-%DATE%.log"),
    fileTransport("error", "logs/error/error-%DATE%.log"),
    new ElasticsearchTransport({
      level: "http",
      clientOpts: {
        node: process.env.ELASTIC_URL || "http://localhost:9200",
      },
      indexPrefix: "blog-management-logs",
      indexSuffixPattern: "YYYY-MM-DD",
    }),
  );
}

/**
 * Main application logger instance.
 *
 * Transports:
 * - Console logs for development and debugging.
 * - Rotating file logs in separate info and error files (non-Jest only). The
 *   info file also receives warn and error entries, because Winston's default
 *   levels treat "info" as including all more severe levels.
 * - Elasticsearch logs for centralized monitoring (non-Jest only), at the
 *   "http" level and above.
 */
const logger = createLogger({
  transports: loggerTransports,
});

module.exports = logger;
