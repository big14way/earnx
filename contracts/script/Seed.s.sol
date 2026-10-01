// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {EarnXProtocol} from "../src/EarnXProtocol.sol";
import {IEarnX} from "../src/interfaces/IEarnX.sol";

/// Submits and verifies the fictional sample invoices in demo/invoices so the testnet app has a
/// live order book. The exporter is a separate demo wallet; the verifier signs off as itself.
/// Each invoice's docsHash is keccak256 of its JSON file, so anyone can check the document.
///
/// forge script script/Seed.s.sol --rpc-url arbitrum_sepolia --broadcast
contract Seed is Script {
    struct Sample {
        string file;
        uint128 faceValue;
        uint40 tenorDays;
        string buyer;
        string commodity;
        string origin;
        string destination;
        uint8 riskScore;
        uint16 aprBps;
        uint16 advanceBps;
        bool settleInUsdc;
    }

    function run() external {
        string memory deployment =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
        EarnXProtocol protocol = EarnXProtocol(vm.parseJsonAddress(deployment, ".protocol"));
        address[] memory tokens = vm.parseJsonAddressArray(deployment, ".tokens");
        require(protocol.invoiceCount() == 0, "already seeded");

        uint256 exporterKey = vm.envUint("DEMO_EXPORTER_PRIVATE_KEY");
        uint256 verifierKey = vm.envUint("VERIFIER_PRIVATE_KEY");
        Sample[] memory samples = _samples();

        for (uint256 i; i < samples.length; ++i) {
            Sample memory s = samples[i];
            string memory doc = vm.readFile(string.concat(vm.projectRoot(), "/demo/invoices/", s.file, ".json"));
            address token = s.settleInUsdc && tokens.length > 1 ? tokens[1] : tokens[0];

            vm.broadcast(exporterKey);
            uint256 id = protocol.submitInvoice(
                IEarnX.SubmitParams({
                    token: token,
                    faceValue: s.faceValue,
                    dueDate: uint40(block.timestamp) + s.tenorDays * 1 days,
                    buyer: s.buyer,
                    commodity: s.commodity,
                    origin: s.origin,
                    destination: s.destination,
                    docsCID: "",
                    docsHash: keccak256(bytes(doc))
                })
            );

            vm.broadcast(verifierKey);
            protocol.verifyInvoice(id, s.riskScore, s.aprBps, s.advanceBps);
            console2.log("seeded invoice", id, s.commodity);
        }
    }

    function _samples() internal pure returns (Sample[] memory s) {
        s = new Sample[](5);
        s[0] = Sample(
            "01-cocoa-ghana-netherlands", 48_000e6, 75, "Sample buyer: cocoa processor, Amsterdam",
            "Cocoa beans", "Ghana", "Netherlands", 28, 1200, 9000, false
        );
        s[1] = Sample(
            "02-cashew-cotedivoire-vietnam", 32_500e6, 60, "Sample buyer: cashew processor, Ho Chi Minh City",
            "Raw cashew nuts", "Cote d'Ivoire", "Vietnam", 35, 1350, 8500, false
        );
        s[2] = Sample(
            "03-sesame-nigeria-japan", 21_000e6, 45, "Sample buyer: food importer, Osaka",
            "Hulled sesame seeds", "Nigeria", "Japan", 40, 1450, 8500, false
        );
        s[3] = Sample(
            "04-cassava-nigeria-ghana", 9_800e6, 30, "Sample buyer: food distributor, Accra",
            "Cassava flour", "Nigeria", "Ghana", 32, 1300, 9000, false
        );
        s[4] = Sample(
            "05-tea-kenya-uae", 27_000e6, 90, "Sample buyer: tea blender, Dubai",
            "Black tea (CTC)", "Kenya", "United Arab Emirates", 25, 1150, 9000, true
        );
    }
}
