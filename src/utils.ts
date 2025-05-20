import { pino } from "pino";
import { join } from "path";
import { cwd } from "process";

const file = join(cwd(), "logs", `${process.pid}-audit-logs`);

const transport = {
  targets: [
    {
      level: "warn",
      target: "pino/file",
      options: {
        destination: file,
      },
    },
    {
      level: "info",
      target: "pino-pretty",
    },
  ],
};

// Logger
export const logger = pino({
  transport
});
