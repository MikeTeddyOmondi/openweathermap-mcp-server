import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mcpServer } from "./openweather-mcp-server.js";
import { logger } from "./utils.js";

const transport = new StdioServerTransport();
await mcpServer.connect(transport);

logger.info("Started MCP server");
logger.info("Listening for messages...");
logger.info("Press Ctrl+C to exit");

process.on("SIGINT", () => {
  logger.warn("Exiting...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.warn("Exiting...");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
  process.exit(1);
});

process.on("exit", (code) => {
  logger.info(`Process exited with code: ${code}`);
});
