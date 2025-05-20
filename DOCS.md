## openweather-mcp-server.ts

Source code

```ts
// openweather-mcp-server.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Redis from "ioredis";

// Create Redis client
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Configuration
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "your_api_key_here";
const OPENWEATHER_API_BASE = "https://api.openweathermap.org/data/2.5";
const CACHE_TTL = 60 * 30; // 30 minutes in seconds

// Weather response types
interface WeatherResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  wind: {
    speed: number;
    deg: number;
  };
  clouds: {
    all: number;
  };
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  name: string;
}

interface ForecastResponse {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    wind: {
      speed: number;
      deg: number;
    };
    clouds: {
      all: number;
    };
    dt_txt: string;
  }>;
  city: {
    name: string;
    country: string;
  };
}

// Helper functions
async function fetchOpenWeatherData<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  try {
    const queryParams = new URLSearchParams({
      ...params,
      appid: OPENWEATHER_API_KEY,
      units: "metric", // Use metric by default
    });
    
    const url = `${OPENWEATHER_API_BASE}${endpoint}?${queryParams}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`OpenWeather API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json() as T;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return null;
  }
}

async function getCachedData<T>(key: string, fetchFn: () => Promise<T | null>, ttl: number): Promise<T | null> {
  try {
    // Try to get from cache first
    const cachedData = await redis.get(key);
    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }
    
    // If not in cache, fetch fresh data
    const freshData = await fetchFn();
    if (freshData) {
      // Store in cache with TTL
      await redis.setex(key, ttl, JSON.stringify(freshData));
    }
    
    return freshData;
  } catch (error) {
    console.error("Cache error:", error);
    // Fallback to direct fetch if cache fails
    return fetchFn();
  }
}

function formatWeatherData(data: WeatherResponse): string {
  return `
Current weather for ${data.name}, ${data.sys.country}:
Temperature: ${data.main.temp}°C (feels like ${data.main.feels_like}°C)
Conditions: ${data.weather[0].main} - ${data.weather[0].description}
Humidity: ${data.main.humidity}%
Wind: ${data.wind.speed} m/s, direction: ${data.wind.deg}°
Sunrise: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}
Sunset: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}
  `.trim();
}

function formatForecastData(data: ForecastResponse): string {
  const forecastItems = data.list.slice(0, 5).map(item => {
    return `
${new Date(item.dt * 1000).toLocaleString()}:
Temperature: ${item.main.temp}°C (feels like ${item.main.feels_like}°C)
Conditions: ${item.weather[0].main} - ${item.weather[0].description}
Humidity: ${item.main.humidity}%
Wind: ${item.wind.speed} m/s
    `.trim();
  });

  return `
5-day forecast for ${data.city.name}, ${data.city.country}:

${forecastItems.join('\n\n')}
  `.trim();
}

// Create the MCP server
export const mcpServer = new McpServer(
  {
    name: "weather-api-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {},
    instructions: `You are a Weather Assistant that can retrieve current weather 
    and forecasts for locations around the world. You can provide temperature, 
    conditions, humidity, wind, and other weather information.`,
  }
);

// Get current weather tool
mcpServer.tool(
  "get-current-weather",
  "Get the current weather for a city",
  {
    city: z.string().describe("Name of the city to get weather for"),
  },
  async ({ city }) => {
    const cacheKey = `weather:current:${city}`;
    
    const weatherData = await getCachedData<WeatherResponse>(
      cacheKey,
      () => fetchOpenWeatherData<WeatherResponse>("/weather", { q: city }),
      CACHE_TTL
    );
    
    if (!weatherData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve weather data for ${city}. Please check the city name and try again.`,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: formatWeatherData(weatherData),
        },
      ],
    };
  }
);

// Get weather forecast tool
mcpServer.tool(
  "get-weather-forecast",
  "Get a 5-day weather forecast for a city",
  {
    city: z.string().describe("Name of the city to get forecast for"),
  },
  async ({ city }) => {
    const cacheKey = `weather:forecast:${city}`;
    
    const forecastData = await getCachedData<ForecastResponse>(
      cacheKey,
      () => fetchOpenWeatherData<ForecastResponse>("/forecast", { q: city }),
      CACHE_TTL
    );
    
    if (!forecastData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve forecast data for ${city}. Please check the city name and try again.`,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: formatForecastData(forecastData),
        },
      ],
    };
  }
);

// Get weather by coordinates tool
mcpServer.tool(
  "get-weather-by-coordinates",
  "Get the current weather using latitude and longitude coordinates",
  {
    lat: z.number().describe("Latitude of the location"),
    lon: z.number().describe("Longitude of the location"),
  },
  async ({ lat, lon }) => {
    const cacheKey = `weather:current:${lat},${lon}`;
    
    const weatherData = await getCachedData<WeatherResponse>(
      cacheKey,
      () => fetchOpenWeatherData<WeatherResponse>("/weather", { 
        lat: lat.toString(), 
        lon: lon.toString() 
      }),
      CACHE_TTL
    );
    
    if (!weatherData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve weather data for coordinates (${lat}, ${lon}).`,
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: formatWeatherData(weatherData),
        },
      ],
    };
  }
);

// Clear cache tool (admin function)
mcpServer.tool(
  "clear-weather-cache",
  "Clear cached weather data for a city",
  {
    city: z.string().optional().describe("Name of the city to clear cache for. If not provided, clears all weather cache."),
  },
  async ({ city }) => {
    try {
      if (city) {
        // Clear specific city cache
        await redis.del(`weather:current:${city}`);
        await redis.del(`weather:forecast:${city}`);
        return {
          content: [
            {
              type: "text",
              text: `Cache cleared for ${city}.`,
            },
          ],
        };
      } else {
        // Clear all weather cache using pattern
        const keys = await redis.keys("weather:*");
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        return {
          content: [
            {
              type: "text",
              text: `All weather cache cleared. Removed ${keys.length} entries.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error("Cache clearing error:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error clearing cache: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }
);
```

---

## sse-server.ts

Source code

```ts
// sse-server.ts
import cors from "cors";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { mcpServer } from "./openweather-mcp-server.js";

const app = express();
const port = process.env.PORT || 10203;

app.use(cors());

let transport: SSEServerTransport;

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
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
        description: "Get the current weather using latitude and longitude coordinates",
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
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SSE endpoint for MCP connections
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");
  transport = new SSEServerTransport("/messages", res);
  await mcpServer.connect(transport);
});

// Message handling endpoint
app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

// Start the server
app.listen(port, () => {
  console.log(`Weather API MCP Server running: http://localhost:${port}`);
  console.log(`SSE endpoint available at: http://localhost:${port}/sse`);
});
```

---

## mcp-client.ts

Source code

```ts
// mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:10203/sse";

// Create MCP client and transport
const transport = new SSEClientTransport(
  new URL(MCP_SERVER_URL),
  { requestInit: { headers: { Accept: "text/event-stream" } } }
);

const client = new Client({
  name: "weather-mcp-client",
  version: "1.0.0",
});

async function main() {
  try {
    console.log(`Connecting to Weather MCP server at ${MCP_SERVER_URL}...`);
    await client.connect(transport);
    console.log("Connected successfully");

    // List available tools
    console.log("Listing available tools...");
    const tools = await client.listTools();
    console.log("Available tools:", tools.map(tool => tool.name).join(", "));

    // Example: Get current weather for New York
    console.log("\nGetting current weather for New York...");
    const currentWeather = await client.callTool({
      name: "get-current-weather",
      arguments: {
        city: "New York",
      },
    });
    console.log("Current weather result:");
    console.log(currentWeather);

    // Example: Get weather forecast for London
    console.log("\nGetting weather forecast for London...");
    const forecast = await client.callTool({
      name: "get-weather-forecast",
      arguments: {
        city: "London",
      },
    });
    console.log("Forecast result:");
    console.log(forecast);

    // Example: Get weather by coordinates
    console.log("\nGetting weather by coordinates (Tokyo)...");
    const coordWeather = await client.callTool({
      name: "get-weather-by-coordinates",
      arguments: {
        lat: 35.6895,
        lon: 139.6917,
      },
    });
    console.log("Coordinates weather result:");
    console.log(coordWeather);

  } catch (error) {
    console.error("Error in MCP client:", error);
  } finally {
    console.log("Closing connection...");
    await transport.close();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other modules
export { client, transport };
```

---