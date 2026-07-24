import { getProductionReadiness } from "../lib/production-readiness";

const result = getProductionReadiness();
if (!result.ready) {
  const missing = result.checks.filter((check) => !check.ready).map((check) => check.key);
  console.error(`Production configuration is not ready: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Production configuration is ready.");
}
