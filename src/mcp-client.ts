import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { logger } from "./utils.js";

const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || "http://localhost:32200/sse";

// Create MCP client and transport
const transport = new SSEClientTransport(new URL(MCP_SERVER_URL), {
  requestInit: { headers: { Accept: "text/event-stream" } },
});

const client = new Client({
  name: "weather-mcp-client",
  version: "1.0.0",
});

async function main() {
  try {
    logger.info(`Connecting to Weather MCP server at ${MCP_SERVER_URL}...`);
    await client.connect(transport);
    logger.info("Connected successfully");

    // List available tools
    logger.info("Listing available tools...");
    const tools = await client.listTools();
    console.log({ tools });
    logger.info(
      // @ts-ignore
      // { toolsMap: tools.map((tool) => tool.name).join(", ") },
      "Available tools:"
    );

    // Example: Get current weather for New York
    logger.info("\nGetting current weather for New York...");
    const currentWeather = await client.callTool({
      name: "get-current-weather",
      arguments: {
        city: "New York",
      },
    });
    logger.info("Current weather result:");
    logger.info(currentWeather);

    // Example: Get weather forecast for London
    logger.info("\nGetting weather forecast for London...");
    const forecast = await client.callTool({
      name: "get-weather-forecast",
      arguments: {
        city: "London",
      },
    });
    logger.info("Forecast result:");
    logger.info(forecast);

    // Example: Get weather by coordinates
    logger.info("\nGetting weather by coordinates (Tokyo)...");
    const coordWeather = await client.callTool({
      name: "get-weather-by-coordinates",
      arguments: {
        lat: 35.6895,
        lon: 139.6917,
      },
    });
    logger.info("Coordinates weather result:");
    logger.info(coordWeather);
  } catch (error) {
    console.error("Error in MCP client:", error);
  } finally {
    logger.info("Closing connection...");
    await transport.close();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error({ error }, "Error running main() - mcp-client:");
  });
}

// Export for use in other modules
export { client, transport };
