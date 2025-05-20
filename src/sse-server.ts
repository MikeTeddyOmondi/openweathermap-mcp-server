import cors from "cors";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { mcpServer } from "./openweather-mcp-server.js";
import { logger } from "./utils.js";

const app = express();
const port = process.env.PORT || 10203;

app.use(cors());

let transport: SSEServerTransport;

// Middleware to log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Server info endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Weather API MCP Server",
    description: "A server to retrieve and cache weather data from OpenWeather",
    version: "1.0.0",
    endpoints: {
      "/": "Get the server information (this response)",
      "/sse": "Server Sent Events stream for MCP connections",
      "/messages": "Post endpoint for sending MCP messages",
      "/health": "Health check endpoint",
    },
    tools: [
      {
        name: "get-current-weather",
        description: "Get the current weather for a city",
        parameters: { city: "string" },
      },
      {
        name: "get-weather-forecast",
        description: "Get a 5-day weather forecast for a city",
        parameters: { city: "string" },
      },
      {
        name: "get-weather-by-coordinates",
        description:
          "Get the current weather using latitude and longitude coordinates",
        parameters: { lat: "number", lon: "number" },
      },
      {
        name: "clear-weather-cache",
        description: "Clear cached weather data for a city",
        parameters: { city: "string (optional)" },
      },
    ],
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  logger.info("Health check...");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SSE endpoint for MCP connections
app.get("/sse", async (req, res) => {
  logger.info("🫱🏿‍🫲🏿 New SSE connection established...");
  transport = new SSEServerTransport("/messages", res);
  await mcpServer.connect(transport);
});

// Message handling endpoint
app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

// Start the server
app.listen(port, () => {
  logger.info(`OpenWeatherMap MCP Server running: http://localhost:${port}`);
  logger.info(`SSE endpoint available at: http://localhost:${port}/sse`);
});
