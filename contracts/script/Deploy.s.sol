// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {EarnXProtocol, IEarnXInvoiceNFT} from "../src/EarnXProtocol.sol";
import {EarnXInvoiceNFT} from "../src/EarnXInvoiceNFT.sol";
import {IEarnX} from "../src/interfaces/IEarnX.sol";
import {MockStablecoin} from "../test/mocks/MockStablecoin.sol";

/// forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast
/// forge script script/Deploy.s.sol --rpc-url robinhood_testnet --broadcast
contract Deploy is Script {
    // Official test tokens, checked on-chain (symbol, 6 decimals) on 2026-10-01.
    address internal constant USDG_ARBITRUM_SEPOLIA = 0xFFC95faa3d63Cde504a05B567C600B78C0b41892; // Paxos
    address internal constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d; // Circle
    address internal constant USDG_ROBINHOOD_TESTNET = 0x7E955252E15c84f5768B83c41a71F9eba181802F; // Paxos

    uint16 internal constant FEE_BPS = 100; // 1% of every advance goes to the first-loss reserve
    uint40 internal constant GRACE_PERIOD = 30 days;
    uint40 internal constant FUNDING_WINDOW = 14 days;
    uint256 internal constant MIN_INVESTMENT = 1e6; // 1 USDG / USDC

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        address verifier = vm.envOr("VERIFIER_ADDRESS", deployer);

        vm.startBroadcast(key);
        address[] memory tokens = _tokens();

        // The NFT and the protocol point at each other immutably, so predict the protocol address.
        address predicted = vm.computeCreateAddress(deployer, vm.getNonce(deployer) + 1);
        EarnXInvoiceNFT nft = new EarnXInvoiceNFT(IEarnX(predicted));
        EarnXProtocol protocol =
            new EarnXProtocol(deployer, verifier, IEarnXInvoiceNFT(address(nft)), FEE_BPS, GRACE_PERIOD, FUNDING_WINDOW);
        require(address(protocol) == predicted, "protocol address prediction failed");

        for (uint256 i; i < tokens.length; ++i) {
            protocol.configureToken(tokens[i], true, MIN_INVESTMENT);
        }
        vm.stopBroadcast();

        _record(protocol, nft, tokens, deployer, verifier);
    }

    function _tokens() internal returns (address[] memory tokens) {
        if (block.chainid == 421614) {
            tokens = new address[](2);
            tokens[0] = USDG_ARBITRUM_SEPOLIA;
            tokens[1] = USDC_ARBITRUM_SEPOLIA;
        } else if (block.chainid == 46630) {
            tokens = new address[](1);
            tokens[0] = USDG_ROBINHOOD_TESTNET;
        } else if (block.chainid == 31337) {
            tokens = new address[](1);
            tokens[0] = address(new MockStablecoin("Global Dollar (local)", "USDG"));
        } else {
            revert("unsupported chain");
        }
    }

    function _record(
        EarnXProtocol protocol,
        EarnXInvoiceNFT nft,
        address[] memory tokens,
        address deployer,
        address verifier
    ) internal {
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployedAtBlock", block.number);
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeAddress(obj, "verifier", verifier);
        vm.serializeAddress(obj, "invoiceNFT", address(nft));
        vm.serializeAddress(obj, "tokens", tokens);
        string memory json = vm.serializeAddress(obj, "protocol", address(protocol));
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("EarnXProtocol  ", address(protocol));
        console2.log("EarnXInvoiceNFT", address(nft));
        console2.log("written to     ", path);
    }
}
