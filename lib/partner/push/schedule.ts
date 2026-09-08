import { after } from "next/server";

export function schedulePartnerPush(label: string, task: () => Promise<void>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[partner-push] ${label} hook failed`, {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
    }
  });
}
