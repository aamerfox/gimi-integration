import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// -----------------------------------------------------------------------------
// 1. ENVIRONMENT VALIDATION
// -----------------------------------------------------------------------------
const envSchema = z.object({
  OCI_API_URL: z.string().url().default("https://tag.traceplus.co/custom-api"),
  TS_API_URL: z.string().url().default("https://api.tracksolidpro.com/api"),
  // Note: Never hardcode API keys in source code. Enforce them at the environment level.
  // TRACEPLUS_API_KEY: z.string().min(1, "API Key is required"),
});

const env = envSchema.parse(process.env);

// -----------------------------------------------------------------------------
// 2. STRUCTURED LOGGING
// -----------------------------------------------------------------------------
class Logger {
  log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };
    // MCP uses stderr for logging, as stdout is reserved for the protocol
    console.error(JSON.stringify(entry));
  }
  info(message: string, context?: any) { this.log('info', message, context); }
  error(message: string, error: Error | unknown, context?: any) {
    const errorDetails = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
    this.log('error', message, { ...context, ...errorDetails });
  }
}
const logger = new Logger();

// -----------------------------------------------------------------------------
// 3. SERVICE LAYER (Abstracts API fetching from MCP logic)
// -----------------------------------------------------------------------------
class TelemetryService {
  async getDeviceLocation(imei: string) {
    // Implement API fetching here. Mocked for initial integration.
    // Replace with: await axios.get(`${env.OCI_API_URL}/devices/${imei}/location`, { headers: ... })
    logger.info("Fetching device location", { imei, source: "OCI_API" });
    
    // Simulate API delay and response
    return {
      imei,
      lat: 24.7136,
      lng: 46.6753,
      speed: 65,
      course: 120,
      status: "moving",
      timestamp: new Date().toISOString()
    };
  }

  async getTrackHistory(imei: string, startTime: string, endTime: string) {
    logger.info("Fetching track history", { imei, startTime, endTime, source: "OCI_API" });
    
    return [
      { lat: 24.7136, lng: 46.6753, time: startTime },
      { lat: 24.7140, lng: 46.6760, time: endTime }
    ];
  }

  async getDeviceAlarms(imei: string) {
    logger.info("Fetching device alarms", { imei, source: "OCI_API" });
    return [
      { type: "overspeed", time: new Date().toISOString(), value: "120km/h" }
    ];
  }

  async sendDeviceCommand(imei: string, commandType: string, params?: Record<string, any>) {
    logger.info("Sending device command", { imei, commandType, params, source: "OCI_API" });
    return { success: true, message: `Command ${commandType} sent to ${imei}` };
  }
}
const telemetryService = new TelemetryService();

// -----------------------------------------------------------------------------
// 4. MCP SERVER & TOOL REGISTRATION
// -----------------------------------------------------------------------------
const server = new McpServer({
  name: "Traceplus-Airia-Integration",
  version: "1.0.0"
});

// Tool 1: Get Device Location
server.tool(
  "get_device_location",
  "Fetch the live coordinates and status of a specific device/vehicle.",
  {
    imei: z.string().describe("The IMEI of the device to query"),
  },
  async ({ imei }) => {
    try {
      const location = await telemetryService.getDeviceLocation(imei);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, data: location }, null, 2) }]
      };
    } catch (error: unknown) {
      logger.error("Failed to execute get_device_location tool", error, { imei });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: "Failed to fetch device location." }) }],
        isError: true
      };
    }
  }
);

// Tool 2: Get Track History
server.tool(
  "get_track_history",
  "Fetch the historical path of a device within a specific time range.",
  {
    imei: z.string().describe("The IMEI of the device"),
    startTime: z.string().datetime().describe("ISO string of start time"),
    endTime: z.string().datetime().describe("ISO string of end time")
  },
  async ({ imei, startTime, endTime }) => {
    try {
      const history = await telemetryService.getTrackHistory(imei, startTime, endTime);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, data: history }, null, 2) }]
      };
    } catch (error: unknown) {
      logger.error("Failed to execute get_track_history tool", error, { imei, startTime, endTime });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: "Failed to fetch track history." }) }],
        isError: true
      };
    }
  }
);

// Tool 3: Get Device Alarms
server.tool(
  "get_device_alarms",
  "Fetch recent alarms and alerts for a specific device.",
  {
    imei: z.string().describe("The IMEI of the device")
  },
  async ({ imei }) => {
    try {
      const alarms = await telemetryService.getDeviceAlarms(imei);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, data: alarms }, null, 2) }]
      };
    } catch (error: unknown) {
      logger.error("Failed to execute get_device_alarms tool", error, { imei });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: "Failed to fetch device alarms." }) }],
        isError: true
      };
    }
  }
);

// Tool 4: Send Device Command
server.tool(
  "send_device_command",
  "Dispatch a hardware command to a device (e.g., relay cutoff).",
  {
    imei: z.string().describe("The IMEI of the target device"),
    commandType: z.string().describe("The type of command to send (e.g., 'RelayCutoff', 'Restart')"),
    params: z.record(z.string(), z.any()).optional().describe("Optional parameters for the command")
  },
  async ({ imei, commandType, params }) => {
    try {
      const result = await telemetryService.sendDeviceCommand(imei, commandType, params);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, data: result }, null, 2) }]
      };
    } catch (error: unknown) {
      logger.error("Failed to execute send_device_command tool", error, { imei, commandType, params });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: "Failed to send device command." }) }],
        isError: true
      };
    }
  }
);

// -----------------------------------------------------------------------------
// 5. SERVER INITIALIZATION
// -----------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Airia MCP Server initialized and connected to stdio transport");
}

main().catch((error) => {
  logger.error("Fatal error during MCP server startup", error);
  process.exit(1);
});
