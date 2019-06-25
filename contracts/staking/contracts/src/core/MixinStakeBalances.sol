/*

  Copyright 2018 ZeroEx Intl.

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

pragma solidity ^0.5.5;
pragma experimental ABIEncoderV2;

import "../interfaces/IStructs.sol";
import "@0x/contracts-utils/contracts/src/SafeMath.sol";
import "../immutable/MixinConstants.sol";
import "../immutable/MixinStorage.sol";
import "./MixinEpoch.sol";


contract MixinStakeBalances is
    SafeMath,
    MixinConstants,
    MixinStorage,
    MixinEpoch
{

    function getActivatedStakeAcrossAllOwners()
        public
        view
        returns (uint256)
    {
        return totalActivatedStake;
    }

    function getTotalStake(address owner)
        public
        view
        returns (uint256)
    {
        return stakeByOwner[owner];
    }

    function getActivatedStake(address owner)
        public
        view
        returns (uint256)
    {
        return activeStakeByOwner[owner];
    }

    function getDeactivatedStake(address owner)
        public
        view
        returns (uint256)
    {
        return _safeSub(getTotalStake(owner), getActivatedStake(owner));
    }


    function getActivatedAndUndelegatedStake(address owner)
        public
        view
        returns (uint256)
    {
        return _safeSub(activeStakeByOwner[owner], getStakeDelegatedByOwner(owner));
    }

    function getActivatableStake(address owner)
        public
        view
        returns (uint256)
    {
        return _safeSub(getDeactivatedStake(owner), getTimelockedStake(owner));
    }

    function getWithdrawableStake(address owner)
        public
        view
        returns (uint256)
    {
        return getActivatableStake(owner);
    }

    function getStakeDelegatedByOwner(address owner)
        public
        view
        returns (uint256)
    {
        return delegatedStakeByOwner[owner];
    }

    function getStakeDelegatedToPoolByOwner(address owner, bytes32 poolId)
        public
        view
        returns (uint256)
    {
        return delegatedStakeToPoolByOwner[owner][poolId];
    }

    function getStakeDelegatedToPool(bytes32 poolId)
        public
        view
        returns (uint256)
    {
        return delegatedStakeByPoolId[poolId];
    }

    function getTimelockedStake(address owner)
        public
        view
        returns (uint256)
    {
        (Timelock memory timelock,) = _getSynchronizedTimelock(owner);
        return timelock.total;
    }

    function _getSynchronizedTimelock(address owner)
        internal
        view
        returns (
            IStructs.Timelock memory ownerTimelock,
            bool isOutOfSync
        )
    {
        uint64 currentTimelockPeriod = getCurrentTimelockPeriod();
        ownerTimelock = timelockedStakeByOwner[owner];
        isOutOfSync = false;
        if (currentTimelockPeriod == _safeAdd(ownerTimelock.lockedAt, 1)) {
            // shift n periods
            ownerTimelock.pending = ownerTimelock.total;
            isOutOfSync = true;
        } else if(currentTimelockPeriod > ownerTimelock.lockedAt) {
            // Timelock has expired - zero out
            ownerTimelock.lockedAt = 0;
            ownerTimelock.total = 0;
            ownerTimelock.pending = 0;
        }
        return (ownerTimelock, isOutOfSync);
    }
}
