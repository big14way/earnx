// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Optional pricing engine. When set on the protocol, it overrides the APR and advance
/// rate proposed by the verifier, so pricing is deterministic and auditable on-chain.
interface IRiskEngine {
    function quote(uint8 riskScore, uint32 tenorDays, uint256 faceValue)
        external
        view
        returns (uint16 aprBps, uint16 advanceBps);
}
