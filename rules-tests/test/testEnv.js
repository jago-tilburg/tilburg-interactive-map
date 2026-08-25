import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let testEnvPromise = null;

export function getTestEnv() {
  if (!testEnvPromise) {
    testEnvPromise = initializeTestEnvironment({
      projectId: "demo-rules-test",
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
      database: {
        rules: fs.readFileSync(path.resolve(__dirname, "../../database.rules.json"), "utf8"),
        host: "127.0.0.1",
        port: 9000,
      },
      storage: {
        rules: fs.readFileSync(path.resolve(__dirname, "../../storage.rules"), "utf8"),
        host: "127.0.0.1",
        port: 9199,
      },
    });
  }
  return testEnvPromise;
}
