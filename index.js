// Include Solana SDK.
var solana = require('@solana/web3.js');

var accountSize = 1000
  , connection
  , walletKeypair
  , account1Keypair
  , account2Keypair
  , account3Keypair;

Promise.resolve()
  // Create a connection to the localhost node.
  .then(function () {
    connection = new solana.Connection('http://localhost:8899');
  })

  // Create a new keypair for the wallet, and another one for the new
  // accounts we'll create.
  .then(function () {
    walletKeypair = solana.Keypair.generate();
    account1Keypair = solana.Keypair.generate();
    account2Keypair = solana.Keypair.generate();
    account3Keypair = solana.Keypair.generate();
  })

  // Give some funding to the wallet in order to run a test successful
  // transaction.
  .then(function () {
    return connection.requestAirdrop(walletKeypair.publicKey,
      solana.LAMPORTS_PER_SOL * 5);
  })
  .then(function (sig) {
    return connection.confirmTransaction(sig);
  })

  // Create a transaction with one instruction that creates an account. This
  // transaction will not be modified after signing, so it should pass.
  .then(function () {
    return Promise.all([
      connection.getRecentBlockhash(),
      connection.getMinimumBalanceForRentExemption(accountSize)
    ]);
  })
  .then(function (responses) {
    var transaction = new solana.Transaction({
      recentBlockhash: responses[0].blockhash
    });
    var instruction = solana.SystemProgram.createAccount({
      fromPubkey: walletKeypair.publicKey,
      newAccountPubkey: account1Keypair.publicKey,
      lamports: responses[1],
      space: accountSize,
      programId: solana.SystemProgram.programId,
    });
    transaction.add(instruction);
    transaction.sign(walletKeypair, account1Keypair);
    return connection.sendRawTransaction(transaction.serialize());
  })
  .then(function (sig) {
    console.log(new Date(), 'Signature #1', sig);
    return connection.confirmTransaction(sig);
  })

  // Now create a transaction that is signed before the instruction is added,
  // in this case, the transaction simulation should fail, saying that the
  // transaction has been modified after sign.
  .then(function () {
    return Promise.all([
      connection.getRecentBlockhash(),
      connection.getMinimumBalanceForRentExemption(accountSize)
    ]);
  })
  .then(function (responses) {
    var transaction, rawTransaction, parsedTransaction;

    // NOTE: Create a transaction normally.
    transaction = new solana.Transaction({
      feePayer: walletKeypair.publicKey,
      recentBlockhash: responses[0].blockhash
    });
    transaction.add(solana.SystemProgram.createAccount({
      fromPubkey: walletKeypair.publicKey,
      newAccountPubkey: account2Keypair.publicKey,
      lamports: responses[1],
      space: accountSize,
      programId: solana.SystemProgram.programId,
    }));
    transaction.partialSign(walletKeypair);
    transaction.partialSign(account2Keypair);

    // NOTE: Serialize the signed transaction as if we were sharing it with
    // someone else.
    rawTransaction = transaction.serialize();

    // NOTE: Someone else deserializes the transaction from what we sent them,
    // then attempts to add another instruction in our behalf without our
    // permission and send it.
    parsedTransaction = solana.Transaction.from(rawTransaction);

    // NOTE: To make this work, you can comment out the statements below.
    // Otherwise the transaction will fail due to being modified after signing.
    parsedTransaction.add(solana.SystemProgram.createAccount({
      fromPubkey: walletKeypair.publicKey,
      newAccountPubkey: account3Keypair.publicKey,
      lamports: responses[1],
      space: accountSize,
      programId: solana.SystemProgram.programId,
    }));
    parsedTransaction.partialSign(account3Keypair);

    // NOTE: Trying to serialize the modified transaction will result in a
    // failed signers check.
    parsedTransaction.serialize();

    return connection.sendRawTransaction(parsedTransaction.serialize());
  })
  .then(function (sig) {
    console.log(new Date(), 'Signature #2', sig);
    return connection.confirmTransaction(sig);
  })

  .catch(function (error) {
    console.log(new Date(), error);
  });
