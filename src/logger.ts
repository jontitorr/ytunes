/* eslint-disable @typescript-eslint/no-explicit-any */

export const logger = {
  debug(...args: any[]) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `\x1b[34m[${new Date().toISOString()}] DEBUG\x1b[0m`,
        ...args
      );
    }
  },

  info(...args: any[]) {
    console.info(`\x1b[36m[${new Date().toISOString()}] INFO\x1b[0m`, ...args);
  },

  warn(...args: any[]) {
    console.warn(`\x1b[33m[${new Date().toISOString()}] WARN\x1b[0m`, ...args);
  },

  error(...args: any[]) {
    console.error(
      `\x1b[31m[${new Date().toISOString()}] ERROR\x1b[0m`,
      ...args
    );
  },

  fatal(...args: any[]) {
    console.error(
      `\x1b[41m\x1b[37m[${new Date().toISOString()}] FATAL\x1b[0m`,
      ...args
    );
  },
};
