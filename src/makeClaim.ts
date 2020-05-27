//
import {
	encodeUnsignedTransaction,
	getTxHash,
	methods,
	getRegistry,
	getEthereumPayload,
	getPolkadotStatement
} from '@substrate/txwrapper';
import {
  ClaimInputs,
  getChainData,
  getSenderData,
  promptSignature,
  getClaimType,
  submitTransaction
} from './util/util';

// User Inputs. This is a bit of a hack that `senderAddress` and `polkadotAddress` should be the
// same. This is a bit of a unique transaction in that it's not signed by the Polkadot key, so
// this entire script stands out from the common patterns.
const inputs: ClaimInputs = {
  senderAddress: '13xGBRvbBR9st4c5CVADqXntUYHbHWCPAyMcEK45P5HFAGEZ',
	polkadotAddress: '13xGBRvbBR9st4c5CVADqXntUYHbHWCPAyMcEK45P5HFAGEZ',
	ethereumAddress: '0x79e21d47fffd0db6f3e00d8cc9f241c9a91556d5',
  tip: 0,
  eraPeriod: 64,
  chainName: 'Polkadot',
  specName: 'polkadot',
  sidecarHost: 'http://127.0.0.1:8080/',
};

async function main(): Promise<void> {
	const chainData = await getChainData(inputs.sidecarHost);
	const senderData = await getSenderData(inputs.sidecarHost, inputs.polkadotAddress);
  const registry = getRegistry(inputs.chainName, inputs.specName, chainData.specVersion);
  
	// Get the Claims type.
  const agreementType = await getClaimType(inputs.sidecarHost, inputs.ethereumAddress);
  // Get the correct Polkadot statement to sign.
  const polkadotStatement = getPolkadotStatement(agreementType);
  // Get the Ethereum payload that will need to be signed with the Ethereum key.
	const ethPayload = getEthereumPayload(
		inputs.polkadotAddress,
		polkadotStatement,
		{
			metadataRpc: chainData.metadataRpc,
			registry
		}
	);

	console.log(`\nSign this statement with your Ethereum key:\n${ethPayload}`);
	const ethSignature = await promptSignature();

	const unsigned = methods.claims.claimAttest(
    {
      dest: inputs.polkadotAddress,
      ethereumSignature: ethSignature,
      statement: polkadotStatement.sentence,
    },
    {
      address: inputs.polkadotAddress,
      blockHash: chainData.blockHash,
      blockNumber: registry.createType('BlockNumber', chainData.blockNumber).toBn().toNumber(),
      eraPeriod: 64,
      genesisHash: chainData.genesisHash,
      metadataRpc: chainData.metadataRpc,
      nonce: senderData.nonce,
			specVersion: chainData.specVersion,
			transactionVersion: chainData.transactionVersion,
      tip: inputs.tip,
    },
    {
      metadataRpc: chainData.metadataRpc,
      registry,
    }
	);

	const tx = encodeUnsignedTransaction(unsigned, { registry });
	console.log(`\nEncoded Tx: ${tx}`);

	// Derive the tx hash of a signed transaction offline.
  const expectedTxHash = getTxHash(tx);
  console.log(`\nExpected Tx Hash: ${expectedTxHash}`);

  // Submit the transaction. Should return the actual hash if accepted by the node.
  const submission = await submitTransaction(inputs.sidecarHost, tx);
	console.log(`\nNode Response: ${submission}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});