const { createLogger, transports, format } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const fs = require("fs");
const { ElasticsearchTransport } = require("winston-elasticsearch");

const { combine, timestamp, json } = format;

/**
 * Ensure log directories exist before writing logs.
 * Skipped under Jest — the workspace `logs/` tree is often root-owned
 * (Docker), and creating DailyRotateFile against it throws uncaught EACCES.
 */
const isJest = process.env.JEST_WORKER_ID !== undefined;

if (!isJest) {
  fs.mkdirSync("logs/info", { recursive: true });
  fs.mkdirSync("logs/error", { recursive: true });
}

/**
 * Console transport (used mainly for development/debugging)
 */
const consoleTransport = new transports.Console({
  level: "info",
  format: combine(timestamp(), json()),
});

/**
 * File transport factory (supports daily rotation logs)
 *
 * @param {string} level - log level (info | error | etc.)
 * @param {string} filename - log file path pattern
 * @returns {DailyRotateFile} configured file transport
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
 * Build the transport list. File + Elasticsearch transports are omitted
 * under Jest so integration/unit workers never open root-owned log files
 * or leave ES connection-pool handles around.
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
 * Main application logger instance
 * - Console logs (dev)
 * - Rotating file logs (info/error separation) — non-Jest only
 * - Elasticsearch logs (centralized monitoring) — non-Jest only
 */
const logger = createLogger({
  transports: loggerTransports,
});

module.exports = logger;
