/* eslint-disable */
import fs from 'fs';

import ArLocal from 'arlocal';
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { Contract, LoggerFactory, Warp, WarpFactory } from '@warp';
import path from 'path';
import { mineBlock } from '../_helpers';

/**
 * This tests verifies a standard approve/transferFrom workflow for a ERC-20ish token contract
 * and a staking contract.
 * 1. User approves certain amount of tokens for staking contract on the token contract
 * 2. User stakes certain amount of tokens on the staking contract - at this point the staking
 * contract makes an internal write to the token contract. The token contract verifies the
 * allowance for the staking contract - and if it is sufficient - performs a transfer on the
 * staking contract address.
 */
describe('Testing internal writes', () => {
  let tokenContractSrc: string;
  let tokenContractInitialState: string;
  let tokenContract: Contract<any>;
  let tokenContractTxId;

  let stakingContractSrc: string;
  let stakingContractInitialState: string;
  let stakingContract: Contract<any>;
  let stakingContractTxId;

  let wallet: JWKInterface;
  let walletAddress: string;

  let arweave: Arweave;
  let arlocal: ArLocal;
  let warp: Warp;

  const port = 1950;

  beforeAll(async () => {
    // note: each tests suit (i.e. file with tests that Jest is running concurrently
    // with another files has to have ArLocal set to a different port!)
    arlocal = new ArLocal(port, false);
    await arlocal.start();
    LoggerFactory.INST.logLevel('error');
  });

  afterAll(async () => {
    await arlocal.stop();
  });

  async function deployContracts() {
    warp = WarpFactory.forLocal(port);
    ({ arweave } = warp);
    wallet = await warp.testing.generateWallet();
    walletAddress = await arweave.wallets.jwkToAddress(wallet);

    tokenContractSrc = fs.readFileSync(path.join(__dirname, '../data/staking/erc-20.js'), 'utf8');
    tokenContractInitialState = fs.readFileSync(path.join(__dirname, '../data/staking/erc-20.json'), 'utf8');
    stakingContractSrc = fs.readFileSync(path.join(__dirname, '../data/staking/staking-contract.js'), 'utf8');
    stakingContractInitialState = fs.readFileSync(
      path.join(__dirname, '../data/staking/staking-contract.json'),
      'utf8'
    );

    ({ contractTxId: tokenContractTxId } = await warp.createContract.deploy({
      wallet,
      initState: JSON.stringify({
        ...JSON.parse(tokenContractInitialState),
        owner: walletAddress
      }),
      src: tokenContractSrc
    }));

    ({ contractTxId: stakingContractTxId } = await warp.createContract.deploy({
      wallet,
      initState: JSON.stringify({
        ...JSON.parse(stakingContractInitialState),
        tokenTxId: tokenContractTxId
      }),
      src: stakingContractSrc
    }));

    tokenContract = warp
      .contract(tokenContractTxId)
      .setEvaluationOptions({ internalWrites: true, mineArLocalBlocks: false })
      .connect(wallet);
    stakingContract = warp
      .contract(stakingContractTxId)
      .setEvaluationOptions({ internalWrites: true, mineArLocalBlocks: false })
      .connect(wallet);

    await mineBlock(warp);
  }

  describe('with read states in between', () => {
    beforeAll(async () => {
      await deployContracts();
    });

    it('should deploy contracts with initial state', async () => {
      expect((await tokenContract.readState()).state).toEqual({
        allowances: {},
        balances: {},
        owner: walletAddress,
        ticker: 'ERC-20',
        totalSupply: 0
      });
      expect((await stakingContract.readState()).state).toEqual({
        minimumStake: 1000,
        stakes: {},
        tokenTxId: tokenContractTxId,
        unstakePeriod: 10
      });
    });

    it('should mint tokens', async () => {
      await tokenContract.writeInteraction({
        function: 'mint',
        account: walletAddress,
        amount: 10000
      });
      await mineBlock(warp);

      const tokenState = (await tokenContract.readState()).state;

      expect(tokenState.balances).toEqual({
        [walletAddress]: 10000
      });
      expect(tokenState.totalSupply).toEqual(10000);
    });

    it('should not stake tokens if no allowance', async () => {
      await stakingContract.writeInteraction({
        function: 'stake',
        amount: 1000
      });
      await mineBlock(warp);

      expect((await stakingContract.readState()).state.stakes).toEqual({});

      const tokenState = (await tokenContract.readState()).state;
      expect(tokenState.balances).toEqual({
        [walletAddress]: 10000
      });
    });

    it('should approve for staking contract', async () => {
      await tokenContract.writeInteraction({
        function: 'approve',
        spender: stakingContractTxId,
        amount: 9999
      });
      await mineBlock(warp);

      expect((await tokenContract.readState()).state.allowances).toEqual({
        [walletAddress]: {
          [stakingContractTxId]: 9999
        }
      });
    });

    it('should stake tokens', async () => {
      await stakingContract.writeInteraction({
        function: 'stake',
        amount: 1000
      });
      await mineBlock(warp);

      expect((await stakingContract.readState()).state.stakes).toEqual({
        [walletAddress]: {
          amount: 1000,
          unlockWhen: 0
        }
      });

      const tokenState = (await tokenContract.readState()).state;
      expect(tokenState.balances).toEqual({
        [walletAddress]: 9000,
        [stakingContractTxId]: 1000
      });
      expect(tokenState.allowances).toEqual({
        [walletAddress]: {
          [stakingContractTxId]: 8999
        }
      });
    });
  });

  describe('with read states at the end', () => {
    beforeAll(async () => {
      await deployContracts();
    });

    it('should stake tokens', async () => {
      expect((await tokenContract.readState()).state).toEqual({
        allowances: {},
        balances: {},
        owner: walletAddress,
        ticker: 'ERC-20',
        totalSupply: 0
      });
      expect((await stakingContract.readState()).state).toEqual({
        minimumStake: 1000,
        stakes: {},
        tokenTxId: tokenContractTxId,
        unstakePeriod: 10
      });

      await tokenContract.writeInteraction({
        function: 'mint',
        account: walletAddress,
        amount: 10000
      });
      await mineBlock(warp);

      await stakingContract.writeInteraction({
        function: 'stake',
        amount: 1000
      });
      await mineBlock(warp);

      await tokenContract.writeInteraction({
        function: 'approve',
        spender: stakingContractTxId,
        amount: 9999
      });
      await mineBlock(warp);

      await stakingContract.writeInteraction({
        function: 'stake',
        amount: 1000
      });
      await mineBlock(warp);

      const tokenState = (await tokenContract.readState()).state;
      expect(tokenState.balances).toEqual({
        [walletAddress]: 9000,
        [stakingContractTxId]: 1000
      });
      expect(tokenState.allowances).toEqual({
        [walletAddress]: {
          [stakingContractTxId]: 8999
        }
      });
      expect((await stakingContract.readState()).state.stakes).toEqual({
        [walletAddress]: {
          amount: 1000,
          unlockWhen: 0
        }
      });
    });
  });
});
