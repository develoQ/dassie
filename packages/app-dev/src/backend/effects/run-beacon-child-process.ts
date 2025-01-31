import type { ViteDevServer } from "vite"
import type { ViteNodeServer } from "vite-node/server"

import type { EffectContext } from "@dassie/lib-reactive"

import type { BeaconDefinition } from "./run-beacons"
import { runChildProcess } from "./run-child-process"

interface RunNodeChildProcessProperties<T> {
  viteServer: ViteDevServer
  nodeServer: ViteNodeServer
  beacon: BeaconDefinition<T>
}

export const runBeaconChildProcess = async <T>(
  sig: EffectContext,
  { viteServer, nodeServer, beacon }: RunNodeChildProcessProperties<T>
) => {
  await sig.run(runChildProcess, {
    nodeServer,
    id: beacon.id,
    environment: {
      FORCE_COLOR: "1",
      ...process.env,
      DASSIE_LOG_FORMATTER: "json",
      DASSIE_CONFIG: JSON.stringify(beacon.config),
      DASSIE_DEV_ROOT: viteServer.config.root,
      DASSIE_DEV_BASE: viteServer.config.base,
      DASSIE_DEV_ENTRY: beacon.entry ?? "src/index.ts",
      DASSIE_DEV_RPC_URL: "wss://dev-rpc.localhost:10001",
      DASSIE_DEV_NODE_ID: beacon.id,
    },
  })
}
