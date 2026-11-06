import "dotenv/config";
import { migrate, closePool } from "./db.js";

migrate()
  .then(() => console.log("Skema PostgreSQL LOKAWIRA sudah diterapkan."))
  .catch((cause) => {
    console.error("Migrasi backend gagal:", cause);
    process.exitCode = 1;
  })
  .finally(closePool);
