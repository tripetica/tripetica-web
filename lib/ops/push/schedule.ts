import { after } from "next/server";

export function scheduleOpsPush(
  label: string,
  task: () => Promise<void>,
) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[ops-push] ${label} hook failed`, {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
    }
  });
}
