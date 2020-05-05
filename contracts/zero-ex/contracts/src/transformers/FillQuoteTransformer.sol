/*

  Copyright 2020 ZeroEx Intl.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity ^0.6.5;
pragma experimental ABIEncoderV2;

import "@0x/contracts-utils/contracts/src/v06/errors/LibRichErrorsV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibBytesV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/LibERC20TokenV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/LibMathV06.sol";
import "@0x/contracts-utils/contracts/src/v06/ReentrancyGuardV06.sol";
import "../errors/LibTransformERC20RichErrors.sol";
import "../vendor/v3/IExchange.sol";
import "./IERC20Transformer.sol";
import "./LibERC20Transformer.sol";


/// @dev A transformer that fills an ERC20 market sell/buy quote.
contract FillQuoteTransformer is
    IERC20Transformer,
    ReentrancyGuardV06
{
    // solhint-disable indent,no-empty-blocks,no-unused-vars

    /// @dev Data to encode and pass to `transform()`.
    struct FillSellQuoteTransformData {
        // The token being sold.
        // This should be an actual token, not the ETH pseudo-token.
        IERC20TokenV06 sellToken;
        // The token being bought.
        // This should be an actual token, not the ETH pseudo-token.
        IERC20TokenV06 buyToken;
        // The orders to fill.
        IExchange.Order[] orders;
        // Signatures for each respective order in `orders`.
        bytes[] signatures;
        // Maximum fill amount for each order.
        uint256[] maxOrderFillAmounts;
        // Amount of `sellToken` to sell. Zero if performing a market buy.
        uint256 sellAmount;
        // Amount of `buyToken` to buy. Zero if performing a market sell.
        uint256 buyAmount;
    }

    /// @dev Results of a call to `_fillOrder()`.
    struct FillOrderResults {
        // The amount of taker tokens sold, according to balance checks.
        uint256 takerTokenSoldAmount;
        // The amount of maker tokens sold, according to balance checks.
        uint256 makerTokenBoughtAmount;
    }

    /// @dev The Exchange contract.
    IExchange public immutable exchange;
    /// @dev The ERC20Proxy address.
    address public immutable erc20Proxy;
    /// @dev The ERC20Proxy ID.
    bytes4 constant private ERC20_ASSET_PROXY_ID = 0xf47261b0;

    using LibERC20TokenV06 for IERC20TokenV06;
    using LibSafeMathV06 for uint256;
    using LibRichErrorsV06 for bytes;

    constructor(IExchange exchange_) public {
        exchange = exchange_;
        erc20Proxy = exchange_.getAssetProxy(ERC20_ASSET_PROXY_ID);
    }

    /// @dev Sell this contract's entire balance of of `sellToken` in exchange
    ///      for `buyToken` by filling `orders`. Protocol fees should be attached
    ///      to this call. `buyToken` and excess ETH will be transferred back to the caller.
    ///      This function cannot be re-entered.
    /// @param data_ ABI-encoded `FillSellQuoteTransformData`.
    /// @return success `TRANSFORMER_SUCCESS` on success.
    function transform(
        bytes32, // callDataHash,
        address payable, // taker,
        IERC20TokenV06[] calldata, // tokens,
        uint256[] calldata, // amounts,
        bytes calldata data_
    )
        external
        override
        payable
        nonReentrant
        returns (bytes4 success)
    {
        FillSellQuoteTransformData memory data =
            abi.decode(data_, (FillSellQuoteTransformData));

        // If `sellAmount == -1` and `buyAmount == 0` then we are selling
        // our entire balance of `sellToken`. This is useful in cases where
        // the exact sell amount is not known in advance, like when unwrapping
        // Chai/cUSDC/cDAI.
        if (data.sellAmount == uint256(-1) && data.buyAmount == 0) {
            data.sellAmount = data.sellToken.balanceOf(address(this));
        }

        // Approve the ERC20 proxy to spend `sellToken`.
        data.sellToken.approveIfBelow(erc20Proxy, data.sellAmount);

        // Fill the orders.
        uint256 singleProtocolFee = exchange.protocolFeeMultiplier().safeMul(tx.gasprice);
        uint256 boughtAmount = 0;
        uint256 soldAmount = 0;
        for (uint256 i = 0; i < data.orders.length; ++i) {
            // Check if we've hit our targets.
            if (data.buyAmount == 0) {
                // Market sell check.
                if (data.sellAmount >= soldAmount) {
                    break;
                }
            } else {
                // Market buy check.
                if (data.buyAmount >= boughtAmount) {
                    break;
                }
            }

            // Approve the taker fee token.
            if (data.orders[i].takerFee != 0) {
                IERC20TokenV06 takerFeeToken = _getTokenFromAssetData(data.orders[i].takerFeeAssetData);
                if (address(takerFeeToken) != address(0) && takerFeeToken != data.sellToken) {
                    // HACK(dorothy-zbornak): It isn't worth computing the actual taker fee
                    // since `approveIfBelow()` will set the allowance to infinite. We
                    // just need a reasonable upper bound to avoid unnecessarily re-approving.
                    takerFeeToken.approveIfBelow(erc20Proxy, data.orders[i].takerFee);
                }
            }

            // Compute the remaining fill amount.
            uint256 fillAmount = (data.buyAmount == 0)
                // Market sell.
                ? data.sellAmount.safeSub(soldAmount)
                // Market buy, so compute the fill amount from the bought amount.
                : data.sellAmount.safeSub(
                    LibMathV06.getPartialAmountFloor(
                        boughtAmount,
                        data.buyAmount,
                        data.sellAmount
                    )
                );
            fillAmount = LibSafeMathV06.min256(fillAmount, data.maxOrderFillAmounts[i]);

            // Fill the order.
            FillOrderResults memory results = _fillOrder(
                data.buyToken,
                data.orders[i],
                fillAmount,
                data.signatures[i],
                singleProtocolFee
            );

            // Accumulate totals.
            soldAmount = soldAmount.safeAdd(results.takerTokenSoldAmount);
            boughtAmount = boughtAmount.safeAdd(results.makerTokenBoughtAmount);
        }

        // Ensure we hit our targets.
        if (data.buyAmount == 0) {
            // Market sell check.
            if (soldAmount < data.sellAmount) {
                LibTransformERC20RichErrors
                    .IncompleteFillSellQuoteError(
                        address(data.sellToken),
                        soldAmount,
                        data.sellAmount
                    ).rrevert();
            }
        } else {
            // Market buy check.
            if (boughtAmount < data.buyAmount) {
                LibTransformERC20RichErrors
                    .IncompleteFillBuyQuoteError(
                        address(data.buyToken),
                        boughtAmount,
                        data.buyAmount
                    ).rrevert();
            }
        }

        // Transfer buy tokens.
        data.buyToken.compatTransfer(msg.sender, data.buyToken.balanceOf(address(this)));
        // Return unused sell tokens.
        data.sellToken.compatTransfer(msg.sender, data.sellToken.balanceOf(address(this)));
        // Return unused ETH.
        if (address(this).balance != 0) {
            msg.sender.transfer(address(this).balance);
        }
        return LibERC20Transformer.TRANSFORMER_SUCCESS;
    }

    function _fillOrder(
        IERC20TokenV06 makerToken,
        IExchange.Order memory order,
        uint256 takerTokenFillAmount,
        bytes memory signature,
        uint256 protocolFee
    )
        private
        returns (FillOrderResults memory results)
    {
        // Track changes in the maker token balance.
        results.makerTokenBoughtAmount = makerToken.balanceOf(address(this));

        // Ensure we have enough ETH to cover the protocol fee.
        if (address(this).balance < protocolFee) {
            LibTransformERC20RichErrors
                .InsufficientProtocolFeeError(address(this).balance, protocolFee)
                .rrevert();
        }

        // Perform the fill.
        try
            exchange.fillOrder
                {value: protocolFee}
                (order, takerTokenFillAmount, signature)
            returns (IExchange.FillResults memory fillResults)
        {
            // We can trust the taker asset filled amount from fill results, but
            // not the maker asset filled amount because bridges can fill more
            // than the order specifies.
            results.takerTokenSoldAmount = fillResults.takerAssetFilledAmount;
            // Update maker quantity based on changes in token balances.
            results.makerTokenBoughtAmount = makerToken.balanceOf(address(this))
                .safeSub(results.makerTokenBoughtAmount);
        }
        catch (bytes memory) {
            // If the fill fails, zero out fill quantities.
            results.takerTokenSoldAmount = 0;
        }
    }

    function _getTokenFromAssetData(bytes memory assetData)
        private
        pure
        returns (IERC20TokenV06 token)
    {
        if (assetData.length != 36) {
            return token;
        }
        // We only support plain ERC20 asset data.
        if (LibBytesV06.readBytes4(assetData, 0) != ERC20_ASSET_PROXY_ID) {
            LibTransformERC20RichErrors
                .InvalidERC20AssetDataError(assetData)
                .rrevert();
        }
        return IERC20TokenV06(LibBytesV06.readAddress(assetData, 4));
    }
}
