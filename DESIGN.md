# OpenWeatherMap API MCP Server - System Design

I've designed a modular MCP (Model Context Protocol) server that retrieves weather data from the OpenWeather API and caches it in Redis. This implementation follows the pattern shown in your example while focusing specifically on weather data.

## Architecture Overview

<p class="center">
    <img src="./images/MCP_SERVER_SYSTEM_DESIGN (Dark).png" />
</p>

The system consists of three main components:

1. **OpenWeather MCP Server** - Core functionality for retrieving and caching weather data
2. **SSE Server** - Express server that implements the SSE transport for MCP
3. **Stdio Server** - Express server that implements the Stdio transport for MCP
4. **MCP Client** - Example client to test the server

## Key Features

- **Modular Design**: Clean separation of concerns between weather API, caching, and server infrastructure
- **Redis Caching**: Improves performance and reduces API calls with configurable TTL
- **Multiple Weather Tools**:
  - Current weather by city name
  - 5-day forecast by city name
  - Weather by geographic coordinates
  - Cache management
- **Error Handling**: Robust error handling throughout the codebase
- **Typed Interfaces**: TypeScript interfaces for API responses

## Implementation Details

### OpenWeatherMap MCP Server

The core server implements several tools:

- `get-current-weather`: Retrieves current conditions for a specified city
- `get-weather-forecast`: Gets a 5-day forecast for a city
- `get-weather-by-coordinates`: Gets weather using latitude and longitude
- `clear-weather-cache`: Admin tool to clear the Redis cache

Each tool follows a consistent pattern:

1. Check Redis cache first
2. If not cached, call OpenWeather API
3. Cache the results with TTL
4. Format and return the data

### Caching Strategy

The implementation uses a generic `getCachedData` function that:

- Attempts to retrieve data from Redis cache
- Falls back to fetching fresh data if not cached
- Automatically stores fresh data in the cache with TTL
- Handles Redis connection errors gracefully

## How to Use With AI Models

Once deployed, an AI model like Claude can connect to this MCP server to:

1. Access real-time weather data without needing direct API access
2. Benefit from cached responses for frequently requested locations
3. Format weather information in a human-friendly way

For example, when a user asks "What's the weather in Tokyo?", Claude could connect to this MCP server and call the appropriate tool to get the answer.

## Extension Points

The design is easily extensible to add:

- Additional weather data endpoints (air quality, historical data, etc.)
- Authentication and rate limiting
- More sophisticated caching strategies
- Analytics and logging of weather queries

---
