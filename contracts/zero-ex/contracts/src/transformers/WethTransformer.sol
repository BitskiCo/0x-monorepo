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
import "@0x/contracts-utils/contracts/src/v06/LibSafeMathV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/IEtherTokenV06.sol";
import "../errors/LibTransformERC20RichErrors.sol";
import "./IERC20Transformer.sol";
import "./LibERC20Transformer.sol";


/// @dev A transformer that wraps or unwraps WETH.
contract WethTransformer is
    IERC20Transformer
{
    // solhint-disable indent

    /// @dev The WETH contract address.
    IEtherTokenV06 public immutable weth;

    using LibRichErrorsV06 for bytes;
    using LibSafeMathV06 for uint256;

    constructor(IEtherTokenV06 weth_) public {
        weth = weth_;
    }

    /// @dev Wraps and unwraps WETH, depending on the token transferred.
    ///      If WETH is transferred, it will be unwrapped to ETH.
    ///      If ETH is transferred, it will be wrapped to WETH.
    /// @param tokens The tokens that were transferred to this contract. ETH may
    ///        be included as 0xeee...
    /// @param amounts The amount of each token in `tokens` that were transferred
    ///        to this contract.
    /// @return success `TRANSFORMER_SUCCESS` on success.
    function transform(
        bytes32, // callDataHash,
        address payable, // taker,
        IERC20TokenV06[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata // data
    )
        external
        override
        payable
        returns (bytes4 success)
    {
        if (tokens.length != 1) {
            LibTransformERC20RichErrors
                .WrongNumberOfTokensReceivedError(tokens.length, 1)
                .rrevert();
        }

        uint256 amount = amounts[0];

        if (address(tokens[0]) == LibERC20Transformer.ETH_TOKEN_ADDRESS) {
            // Wrap ETH.
            weth.deposit{value: amount}();
            // Transfer WETH to sender.
            weth.transfer(msg.sender, amount);
        } else if (address(tokens[0]) == address(weth)) {
            // Unwrap WETH.
            weth.withdraw(amount);
            // Transfer ETH to sender.
            msg.sender.transfer(amount);
        } else {
            // Token must be either WETH or ETH.
            LibTransformERC20RichErrors
                .InvalidTokenReceivedError(address(tokens[0]))
                .rrevert();
        }

        return LibERC20Transformer.TRANSFORMER_SUCCESS;
    }
}
