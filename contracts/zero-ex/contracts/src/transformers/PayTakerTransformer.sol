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
import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";
import "@0x/contracts-erc20/contracts/src/v06/LibERC20TokenV06.sol";
import "../errors/LibTransformERC20RichErrors.sol";
import "./IERC20Transformer.sol";
import "./LibERC20Transformer.sol";


/// @dev A transformer that transfers any tokens it receives to the taker.
contract PayTakerTransformer is
    IERC20Transformer
{
    using LibRichErrorsV06 for bytes;
    using LibSafeMathV06 for uint256;
    using LibERC20Transformer for IERC20TokenV06;

    /// @dev Forwards any tokens transffered to the taker.
    /// @param taker The taker address (caller of `TransformERC20.transformERC20()`).
    /// @param tokens The tokens that were transferred to this contract. ETH may
    ///        be included as 0xeee...
    /// @param amounts The amount of each token in `tokens` that were transferred
    ///        to this contract.
    /// @return success `TRANSFORMER_SUCCESS` on success.
    function transform(
        bytes32, // callDataHash,
        address payable taker,
        IERC20TokenV06[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata // data_
    )
        external
        override
        payable
        returns (bytes4 success)
    {
        for (uint256 i = 0; i < amounts.length; ++i) {
            // Transfer tokens directly to the taker.
            tokens[i].transformerTransfer(taker, amounts[i]);
        }
        return LibERC20Transformer.TRANSFORMER_SUCCESS;
    }
}
