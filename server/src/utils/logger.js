const { createLogger, transports, format } = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const fs = require("fs");
const { ElasticsearchTransport } = require("winston-elasticsearch");

const { combine, timestamp, json } = format;

/**
 * Ensure log directories exist before writing logs
 */
fs.mkdirSync("logs/info", { recursive: true });
fs.mkdirSync("logs/error", { recursive: true });

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
 * Elasticsearch transport for centralized logging
 */
const elasticSearchTransport = new ElasticsearchTransport({
  level: "http",
  clientOpts: {
    node: process.env.ELASTIC_URL || "http://localhost:9200",
  },
  indexPrefix: "blog-management-logs",
  indexSuffixPattern: "YYYY-MM-DD",
});

/**
 * Main application logger instance
 * - Console logs (dev)
 * - Rotating file logs (info/error separation)
 * - Elasticsearch logs (centralized monitoring)
 */
const logger = createLogger({
  transports: [
    consoleTransport,
    fileTransport("info", "logs/info/info-%DATE%.log"),
    fileTransport("error", "logs/error/error-%DATE%.log"),
    elasticSearchTransport,
  ],
});

module.exports = logger;
