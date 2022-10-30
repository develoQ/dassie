import { EffectContext, createSignal } from "@dassie/lib-reactive"
import { createDatabase } from "@dassie/lib-sqlite"

import { configSignal } from "../config"
import migrations from "./migrations"
import { incomingPaymentTable } from "./tables/incoming-payment"

/**
 * Unique application ID for identifying the SQLite database as belonging to Dassie.
 *
 * This constant application ID was generated by first generating a random, positive, signed, 32-bit integer
 * and replacing the second through fourth nibbles with the HEX digits "DA5" to represent Dassie.
 */
const DASSIE_SQLITE_APPLICATION_ID = 0x1d_a5_3b_81

export const databaseSignal = (sig: EffectContext) => {
  const { dataPath } = sig.use(configSignal).read()

  const database = createDatabase({
    path: `${dataPath}/dassie.sqlite3`,
    applicationId: DASSIE_SQLITE_APPLICATION_ID,
    migrations,
    tables: {
      incomingPayment: incomingPaymentTable,
    },
    scalars: {},
  })

  return createSignal(database)
}
