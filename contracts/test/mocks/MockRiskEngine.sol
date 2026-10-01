// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IRiskEngine} from "../../src/interfaces/IRiskEngine.sol";

/// @dev Test-only engine: APR = 8% + 0.2% per risk point, advance = 90% minus 0.25% per risk point.
contract MockRiskEngine is IRiskEngine {
    function quote(uint8 riskScore, uint32, uint256) external pure returns (uint16 aprBps, uint16 advanceBps) {
        aprBps = 800 + uint16(riskScore) * 20;
        advanceBps = 9000 - uint16(riskScore) * 25;
    }
}
