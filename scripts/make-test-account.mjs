// Creates a funded testnet account, associates the certificate token with it,
// and prints its account id — used to test the full claim/transfer flow.
import fs from "fs";
import path from "path";
import {
  Client,
  PrivateKey,
  AccountId,
  AccountCreateTransaction,
  Hbar,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";

// load .env.local manually
const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const operatorId = env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromStringDer(env.HEDERA_OPERATOR_KEY);
const tokenId = env.HEDERA_TOKEN_ID;

const client = Client.forTestnet().setOperator(AccountId.fromString(operatorId), operatorKey);

const newKey = PrivateKey.generateECDSA();
const createResp = await new AccountCreateTransaction()
  .setKeyWithoutAlias(newKey.publicKey)
  .setInitialBalance(new Hbar(5))
  .execute(client);
const newAccountId = (await createResp.getReceipt(client)).accountId.toString();
console.log("NEW_ACCOUNT_ID=" + newAccountId);
console.log("NEW_ACCOUNT_KEY=" + newKey.toStringDer());

// associate the token with the new account (signed by its own key)
const assocTx = await new TokenAssociateTransaction()
  .setAccountId(newAccountId)
  .setTokenIds([tokenId])
  .freezeWith(client)
  .sign(newKey);
await (await assocTx.execute(client)).getReceipt(client);
console.log("ASSOCIATED=" + tokenId);

process.exit(0);
