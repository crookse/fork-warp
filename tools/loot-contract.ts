/* eslint-disable */
import Arweave from 'arweave';
import { LoggerFactory } from '../src';
import { TsLogFactory } from '../src/logging/node/TsLogFactory';
import fs from 'fs';
import path from 'path';
import { SmartWeaveWebFactory } from '../src/core/web/SmartWeaveWebFactory';
import { FromFileInteractionsLoader } from './FromFileInteractionsLoader';

async function main() {
  LoggerFactory.use(new TsLogFactory());
  LoggerFactory.INST.logLevel('debug');

  const arweave = Arweave.init({
    host: 'arweave.net', // Hostname or IP address for a Arweave host
    port: 443, // Port
    protocol: 'https', // Network protocol http or https
    timeout: 60000, // Network request timeouts in milliseconds
    logging: false // Enable network request logging
  });

  const contractTxId = 'w27141UQGgrCFhkiw9tL7A0-qWMQjbapU3mq2TfI4Cg';

  const interactionsLoader = new FromFileInteractionsLoader(path.join(__dirname, 'data', 'interactions.json'));

  const smartweave = SmartWeaveWebFactory.memCachedBased(arweave, 1)
    .build();

  const lootContract = smartweave
    .contract(contractTxId)
    .setEvaluationOptions({
      updateCacheForEachInteraction: false
    });

  const { state, validity } = await lootContract.readState();

  //fs.writeFileSync(path.join(__dirname, 'data', 'validity.json'), JSON.stringify(validity));


  //fs.writeFileSync(path.join(__dirname, 'data', 'validity_old.json'), JSON.stringify(result.validity));
  fs.writeFileSync(path.join(__dirname, 'data', 'state.json'), JSON.stringify(state));
}

main().catch((e) => console.error(e));
