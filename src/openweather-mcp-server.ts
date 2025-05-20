import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Redis } from "ioredis";
import { logger } from "./utils.js";
import { config } from "dotenv";

// Load .env file
config();

async function initCache(): Promise<Redis | null> {
  let redis: Redis | null = null;
  if (!redis) {
    try {
      // Create Redis client
      redis = new Redis({
        // host: process.env.REDIS_URL || "0.0.0.0",
        host: process.env.REDIS_HOST || "0.0.0.0",
        port: 6379,
        connectTimeout: 10000,
        keepAlive: 1000,
      });
      await redis.ping();
      logger.info("Connected to cache storage");

      // Set up Redis event handlers
      redis.on("error", (error) => {
        logger.error({ error }, "Redis connection error:");
      });

      redis.on("ready", () => {
        logger.info("Redis connection established");
      });

      redis.on("reconnecting", () => {
        logger.warn("Reconnecting to Redis...");
      });
    } catch (error) {
      logger.error(
        { error },
        "An error occurred while connecting to in-memory store:"
      );
      return null;
    }
  }
  return redis;
}

const redis = await initCache();

// Configuration
const OPENWEATHER_API_KEY =
  process.env.OPENWEATHER_API_KEY || "your_api_key_here";
const OPENWEATHER_API_BASE = "https://api.openweathermap.org/data/2.5";
const CACHE_TTL = 60 * 10; // 10 minutes in seconds

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
async function fetchOpenWeatherData<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T | null> {
  try {
    const queryParams = new URLSearchParams({
      ...params,
      appid: OPENWEATHER_API_KEY,
      units: "metric", // Use metric by default
    });

    const url = `${OPENWEATHER_API_BASE}${endpoint}?${queryParams}`;
    const response = await fetch(url);

    if (!response.ok) {
      logger.error(
        `OpenWeather API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    logger.error("Error fetching weather data:", error);
    return null;
  }
}

async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T | null>,
  ttl: number
): Promise<T | null> {
  try {
    // Try to get from cache first
    const cachedData = await redis?.get(key);
    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }

    // If not in cache, fetch fresh data
    const freshData = await fetchFn();
    if (freshData) {
      // Store in cache with TTL
      await redis?.setex(key, ttl, JSON.stringify(freshData));
    }

    return freshData;
  } catch (error) {
    logger.error("Cache error:", error);
    // Fallback to direct fetch if cache fails
    return fetchFn();
  }
}

function formatWeatherData(data: WeatherResponse): string {
  return `
Current weather for ${data.name}, ${data.sys.country}:
Temperature: ${data.main.temp}°C (feels like ${data.main.feels_like}°C)
Conditions: ${data.weather[0]?.main} - ${data.weather[0]?.description}
Humidity: ${data.main.humidity}%
Wind: ${data.wind.speed} m/s, direction: ${data.wind.deg}°
Sunrise: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}
Sunset: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}
  `.trim();
}

function formatForecastData(data: ForecastResponse): string {
  const forecastItems = data.list.slice(0, 5).map((item) => {
    return `
${new Date(item.dt * 1000).toLocaleString()}:
Temperature: ${item.main.temp}°C (feels like ${item.main.feels_like}°C)
Conditions: ${item.weather[0]?.main} - ${item.weather[0]?.description}
Humidity: ${item.main.humidity}%
Wind: ${item.wind.speed} m/s
    `.trim();
  });

  return `
5-day forecast for ${data.city.name}, ${data.city.country}:

${forecastItems.join("\n\n")}
  `.trim();
}

// Create the MCP server
export const mcpServer = new McpServer(
  {
    name: "openweather-api-mcp",
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
      () =>
        fetchOpenWeatherData<WeatherResponse>("/weather", {
          lat: lat.toString(),
          lon: lon.toString(),
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
    city: z
      .string()
      .optional()
      .describe(
        "Name of the city to clear cache for. If not provided, clears all weather cache."
      ),
  },
  async ({ city }) => {
    try {
      if (city) {
        // Clear specific city cache
        await redis?.del(`weather:current:${city}`);
        await redis?.del(`weather:forecast:${city}`);
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
        const keys = await redis?.keys("weather:*");
        if (keys!.length > 0) {
          await redis?.del(...keys!);
        }
        return {
          content: [
            {
              type: "text",
              text: `All weather cache cleared. Removed ${keys?.length} entries.`,
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
            text: `Error clearing cache: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  }
);
