import { ContractAddresses, getContractAddressesForChainOrThrow } from '@0x/contract-addresses';
import * as artifacts from '@0x/contract-artifacts';
import { ForwarderContract } from '@0x/contract-wrappers';
import {
    ERC1155ProxyContract,
    ERC20BridgeProxyContract,
    ERC20ProxyContract,
    ERC721ProxyContract,
    MultiAssetProxyContract,
    StaticCallProxyContract,
} from '@0x/contracts-asset-proxy';
import { CoordinatorContract, CoordinatorRegistryContract } from '@0x/contracts-coordinator';
import { DevUtilsContract, LibTransactionDecoderContract } from '@0x/contracts-dev-utils';
import { ERC1155MintableContract } from '@0x/contracts-erc1155';
import { DummyERC20TokenContract, WETH9Contract } from '@0x/contracts-erc20';
import { DummyERC721TokenContract } from '@0x/contracts-erc721';
import { ExchangeContract } from '@0x/contracts-exchange';
import {
    artifacts as stakingArtifacts,
    StakingProxyContract,
    TestStakingContract,
    ZrxVaultContract,
} from '@0x/contracts-staking';
import { Web3ProviderEngine } from '@0x/subproviders';
import { BigNumber, providerUtils } from '@0x/utils';
import { SupportedProvider, TxData } from 'ethereum-types';

import { constants } from './utils/constants';
import { erc20TokenInfo, erc721TokenInfo } from './utils/token_info';

/**
 * Creates and deploys all the contracts that are required for the latest
 * version of the 0x protocol.
 * @param supportedProvider  Web3 provider instance. Your provider instance should connect to the testnet you want to deploy to.
 * @param txDefaults Default transaction values to use when deploying contracts (e.g., specify the desired contract creator with the `from` parameter).
 * @returns The addresses of the contracts that were deployed.
 */
export async function runMigrationsAsync(
    supportedProvider: SupportedProvider,
    txDefaults: TxData,
): Promise<ContractAddresses> {
    const provider = providerUtils.standardizeOrThrow(supportedProvider);
    const chainId = new BigNumber(await providerUtils.getChainIdAsync(provider));

    // Proxies
    const erc20Proxy = await ERC20ProxyContract.deployFrom0xArtifactAsync(
        artifacts.ERC20Proxy,
        provider,
        txDefaults,
        artifacts,
    );
    const erc721Proxy = await ERC721ProxyContract.deployFrom0xArtifactAsync(
        artifacts.ERC721Proxy,
        provider,
        txDefaults,
        artifacts,
    );

    // ZRX
    const zrxToken = await DummyERC20TokenContract.deployFrom0xArtifactAsync(
        artifacts.DummyERC20Token,
        provider,
        txDefaults,
        artifacts,
        '0x Protocol Token',
        'ZRX',
        new BigNumber(18),
        new BigNumber(1000000000000000000000000000),
    );

    // Ether token
    const etherToken = await WETH9Contract.deployFrom0xArtifactAsync(artifacts.WETH9, provider, txDefaults, artifacts);

    // Exchange
    const exchange = await ExchangeContract.deployFrom0xArtifactAsync(
        artifacts.Exchange,
        provider,
        txDefaults,
        artifacts,
        chainId,
    );

    // Dummy ERC20 tokens
    for (const token of erc20TokenInfo) {
        const totalSupply = new BigNumber(1000000000000000000000000000);
        // tslint:disable-next-line:no-unused-variable
        const dummyErc20Token = await DummyERC20TokenContract.deployFrom0xArtifactAsync(
            artifacts.DummyERC20Token,
            provider,
            txDefaults,
            artifacts,
            token.name,
            token.symbol,
            token.decimals,
            totalSupply,
        );
    }

    // ERC721
    // tslint:disable-next-line:no-unused-variable
    const cryptoKittieToken = await DummyERC721TokenContract.deployFrom0xArtifactAsync(
        artifacts.DummyERC721Token,
        provider,
        txDefaults,
        artifacts,
        erc721TokenInfo[0].name,
        erc721TokenInfo[0].symbol,
    );

    // 1155 Asset Proxy
    const erc1155Proxy = await ERC1155ProxyContract.deployFrom0xArtifactAsync(
        artifacts.ERC1155Proxy,
        provider,
        txDefaults,
        artifacts,
    );

    const staticCallProxy = await StaticCallProxyContract.deployFrom0xArtifactAsync(
        artifacts.StaticCallProxy,
        provider,
        txDefaults,
        artifacts,
    );

    const multiAssetProxy = await MultiAssetProxyContract.deployFrom0xArtifactAsync(
        artifacts.MultiAssetProxy,
        provider,
        txDefaults,
        artifacts,
    );

    await erc20Proxy.addAuthorizedAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);
    await erc721Proxy.addAuthorizedAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);
    await erc1155Proxy.addAuthorizedAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);
    await multiAssetProxy.addAuthorizedAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);

    // MultiAssetProxy
    await erc20Proxy.addAuthorizedAddress(multiAssetProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await erc721Proxy.addAuthorizedAddress(multiAssetProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await erc1155Proxy.addAuthorizedAddress(multiAssetProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await multiAssetProxy.registerAssetProxy(erc20Proxy.address).awaitTransactionSuccessAsync(txDefaults);
    await multiAssetProxy.registerAssetProxy(erc721Proxy.address).awaitTransactionSuccessAsync(txDefaults);
    await multiAssetProxy.registerAssetProxy(erc1155Proxy.address).awaitTransactionSuccessAsync(txDefaults);
    await multiAssetProxy.registerAssetProxy(staticCallProxy.address).awaitTransactionSuccessAsync(txDefaults);

    // Register the Asset Proxies to the Exchange
    await exchange.registerAssetProxy(erc20Proxy.address).awaitTransactionSuccessAsync(txDefaults);
    await exchange.registerAssetProxy(erc721Proxy.address).awaitTransactionSuccessAsync(txDefaults);
    await exchange.registerAssetProxy(erc1155Proxy.address).awaitTransactionSuccessAsync(txDefaults);
    await exchange.registerAssetProxy(multiAssetProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await exchange.registerAssetProxy(staticCallProxy.address).awaitTransactionSuccessAsync(txDefaults);

    // CoordinatorRegistry
    const coordinatorRegistry = await CoordinatorRegistryContract.deployFrom0xArtifactAsync(
        artifacts.CoordinatorRegistry,
        provider,
        txDefaults,
        artifacts,
    );

    // Coordinator
    const coordinator = await CoordinatorContract.deployFrom0xArtifactAsync(
        artifacts.Coordinator,
        provider,
        txDefaults,
        artifacts,
        exchange.address,
        chainId,
    );

    // Dev Utils
    const devUtils = await DevUtilsContract.deployFrom0xArtifactAsync(
        artifacts.DevUtils,
        provider,
        txDefaults,
        artifacts,
        exchange.address,
        constants.NULL_ADDRESS,
    );

    // LibTransactionDecoder
    const libTransactionDecoder = await LibTransactionDecoderContract.deployFrom0xArtifactAsync(
        artifacts.LibTransactionDecoder,
        provider,
        txDefaults,
        artifacts,
    );

    // tslint:disable-next-line:no-unused-variable
    const erc1155DummyToken = await ERC1155MintableContract.deployFrom0xArtifactAsync(
        artifacts.ERC1155Mintable,
        provider,
        txDefaults,
        artifacts,
    );

    const erc20BridgeProxy = await ERC20BridgeProxyContract.deployFrom0xArtifactAsync(
        artifacts.ERC20BridgeProxy,
        provider,
        txDefaults,
        {},
    );
    await exchange.registerAssetProxy(erc20BridgeProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await erc20BridgeProxy.addAuthorizedAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);
    await erc20BridgeProxy.addAuthorizedAddress(multiAssetProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await multiAssetProxy.registerAssetProxy(erc20BridgeProxy.address).awaitTransactionSuccessAsync(txDefaults);

    const zrxProxy = erc20Proxy.address;
    const zrxVault = await ZrxVaultContract.deployFrom0xArtifactAsync(
        artifacts.ZrxVault,
        provider,
        txDefaults,
        {},
        zrxProxy,
        zrxToken.address,
    );

    // Note we use TestStakingContract as the deployed bytecode of a StakingContract
    // has the tokens hardcoded
    const stakingLogic = await TestStakingContract.deployFrom0xArtifactAsync(
        stakingArtifacts.TestStaking,
        provider,
        txDefaults,
        {},
        etherToken.address,
        zrxVault.address,
    );

    const stakingProxy = await StakingProxyContract.deployFrom0xArtifactAsync(
        artifacts.StakingProxy,
        provider,
        txDefaults,
        {},
        stakingLogic.address,
    );

    await erc20Proxy.addAuthorizedAddress(zrxVault.address).awaitTransactionSuccessAsync(txDefaults);

    // Reference the Proxy as the StakingContract for setup
    const stakingDel = await new TestStakingContract(stakingProxy.address, provider, txDefaults);
    await stakingProxy.addAuthorizedAddress(txDefaults.from).awaitTransactionSuccessAsync(txDefaults);
    await stakingDel.addExchangeAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);
    await exchange.setProtocolFeeCollectorAddress(stakingProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await exchange.setProtocolFeeMultiplier(new BigNumber(150000)).awaitTransactionSuccessAsync(txDefaults);

    await zrxVault.addAuthorizedAddress(txDefaults.from).awaitTransactionSuccessAsync(txDefaults);
    await zrxVault.setStakingProxy(stakingProxy.address).awaitTransactionSuccessAsync(txDefaults);
    await stakingLogic.addAuthorizedAddress(txDefaults.from).awaitTransactionSuccessAsync(txDefaults);
    await stakingLogic.addExchangeAddress(exchange.address).awaitTransactionSuccessAsync(txDefaults);

    // Forwarder
    // Deployed after Exchange and Staking is configured as it queries
    // in the constructor
    const { exchangeV2: exchangeV2Address } = getContractAddressesForChainOrThrow(chainId.toNumber());
    const forwarder = await ForwarderContract.deployFrom0xArtifactAsync(
        artifacts.Forwarder,
        provider,
        txDefaults,
        artifacts,
        exchange.address,
        exchangeV2Address || constants.NULL_ADDRESS,
        etherToken.address,
    );

    const contractAddresses = {
        erc20Proxy: erc20Proxy.address,
        erc721Proxy: erc721Proxy.address,
        erc1155Proxy: erc1155Proxy.address,
        zrxToken: zrxToken.address,
        etherToken: etherToken.address,
        exchange: exchange.address,
        assetProxyOwner: constants.NULL_ADDRESS,
        erc20BridgeProxy: erc20BridgeProxy.address,
        zeroExGovernor: constants.NULL_ADDRESS,
        forwarder: forwarder.address,
        libTransactionDecoder: constants.NULL_ADDRESS,
        orderValidator: constants.NULL_ADDRESS,
        dutchAuction: constants.NULL_ADDRESS,
        coordinatorRegistry: coordinatorRegistry.address,
        coordinator: coordinator.address,
        multiAssetProxy: multiAssetProxy.address,
        staticCallProxy: staticCallProxy.address,
        devUtils: devUtils.address,
        exchangeV2: exchangeV2Address || constants.NULL_ADDRESS,
        zrxVault: zrxVault.address,
        staking: stakingLogic.address,
        stakingProxy: stakingProxy.address,
        uniswapBridge: constants.NULL_ADDRESS,
        eth2DaiBridge: constants.NULL_ADDRESS,
        kyberBridge: constants.NULL_ADDRESS,
        erc20BridgeSampler: constants.NULL_ADDRESS,
        chaiBridge: constants.NULL_ADDRESS,
        dydxBridge: constants.NULL_ADDRESS,
    };
    return contractAddresses;
}

let _cachedContractAddresses: ContractAddresses;

/**
 * Exactly like runMigrationsAsync but will only run the migrations the first
 * time it is called. Any subsequent calls will return the cached contract
 * addresses.
 * @param provider  Web3 provider instance. Your provider instance should connect to the testnet you want to deploy to.
 * @param txDefaults Default transaction values to use when deploying contracts (e.g., specify the desired contract creator with the `from` parameter).
 * @returns The addresses of the contracts that were deployed.
 */
export async function runMigrationsOnceAsync(
    provider: Web3ProviderEngine,
    txDefaults: TxData,
): Promise<ContractAddresses> {
    if (_cachedContractAddresses !== undefined) {
        return _cachedContractAddresses;
    }
    _cachedContractAddresses = await runMigrationsAsync(provider, txDefaults);
    return _cachedContractAddresses;
}
