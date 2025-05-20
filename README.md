# OpenWeatherMap MCP Server

<p class="center">
    <img src="./images/MCP_SERVER_SYSTEM_DESIGN (Light).png" />
</p>

This project provides a Model Context Protocol (MCP) server that connects to the OpenWeatherMap API and caches weather data in Redis/Valkey. It demonstrates how to build a modular MCP server that AI models can use to access external APIs.

## Features

- Retrieve current weather conditions for any city
- Get 5-day weather forecasts
- Query weather by geographic coordinates
- Cache weather data in Redis for improved performance
- SSE (Server-Sent Events) transport for MCP communication
- Stdio (Standard Input Output) transport for MCP communication

## Prerequisites

- Node.js 18+ and npm/yarn
- Redis server running locally or accessible via URL
- OpenWeatherMap API key

## Environment Variables

Create a `.env` file in the project root with:

```
OPENWEATHER_API_KEY=your_api_key_here
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_POST=6379
PORT=10203
```

## Installation

```bash
# Install dependencies
bun install

# Build TypeScript
bun run build

# Start the SSE server
bun start:sse

# Start the Stdio server
bun start:stdio

# Start the MCP Inspector for debugging
bun start:stdio
```

## Project Structure

- `openweather-mcp-server.ts`: Core MCP server with weather tools and Redis caching
- `sse-server.ts`: Express server implementing SSE transport for MCP
- `mcp-client.ts`: Example client to test the MCP server

## Available Tools

The MCP server provides the following tools:

1. `get-current-weather`: Get current weather for a city

- Parameters: `city` (string)

2. `get-weather-forecast`: Get 5-day forecast for a city

- Parameters: `city` (string)

3. `get-weather-by-coordinates`: Get weather using latitude/longitude

- Parameters: `lat` (number), `lon` (number)

4. `clear-weather-cache`: Clear cached weather data

- Parameters: `city` (string, optional) - If not provided, clears all cache

## Integration with AI Models

This MCP server is designed to be used with AI models that support the Model Context Protocol. By connecting to this server, AI models can:

1. Access real-time weather data
2. Query forecasts
3. Provide location-specific weather information

## Example Usage (with Claude or similar model)

Once the server is running, you can instruct an AI model to use it:

"Please connect to my weather MCP server at http://localhost:10203/sse and tell me the current weather in Paris."

The AI would then:

1. Connect to the MCP server
2. Call the `get-current-weather` tool with `city: "Paris"`
3. Return the formatted weather information

## Extending the Server

To add new functionality:

1. Add new tools to `weather-mcp-server.ts` using the `mcpServer.tool()` method
2. Update the server info in `sse-server.ts` to document your new tool
3. Implement any required helper functions and caching logic

## Redis Caching

The server uses Redis to cache weather data with a 30-minute TTL (Time To Live). This reduces API calls to OpenWeather and improves response times.

To clear the cache manually, use the `clear-weather-cache` tool.

---
