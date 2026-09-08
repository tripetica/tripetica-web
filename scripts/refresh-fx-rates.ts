import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { refreshFxQuotes } = await import("../lib/booking/fx/service");
  const result = await refreshFxQuotes({ force: true });

  if (result.ok && result.record) {
    const rates = result.record;
    console.log("ExchangeRate-API Open Access: ok");
    console.log(`source=${rates.source}`);
    console.log(`fetchedAt=${rates.fetchedAt}`);
    console.log(`expiresAt=${rates.expiresAt}`);
    console.log(`providerNextUpdateAt=${rates.providerNextUpdateAt}`);
    console.log(`EUR_TO_USD=${rates.USD}`);
    console.log(`EUR_TO_TRY=${rates.TRY}`);
    console.log(`MARKET_EUR_TO_RUB=${rates.marketEurToRub}`);
    console.log(`EUR_TO_RUB=${rates.RUB}`);
    console.log(`EUR_TO_GBP=${rates.GBP}`);
    return;
  }

  if (result.record) {
    console.error(
      `ExchangeRate-API Open Access: failed (${result.error ?? "error"}); last successful cache kept`,
    );
    process.exitCode = 1;
    return;
  }

  console.error(
    `ExchangeRate-API Open Access: failed (${result.error ?? "error"}); no successful cache yet`,
  );
  process.exitCode = 1;
}

void main();
