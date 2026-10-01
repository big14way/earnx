// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";

import {EarnXProtocol, IEarnXInvoiceNFT} from "../src/EarnXProtocol.sol";
import {EarnXInvoiceNFT} from "../src/EarnXInvoiceNFT.sol";
import {IEarnX} from "../src/interfaces/IEarnX.sol";
import {IRiskEngine} from "../src/interfaces/IRiskEngine.sol";
import {MockStablecoin} from "./mocks/MockStablecoin.sol";
import {MockRiskEngine} from "./mocks/MockRiskEngine.sol";

contract EarnXProtocolTest is Test {
    EarnXProtocol internal protocol;
    EarnXInvoiceNFT internal nft;
    MockStablecoin internal usdg;

    address internal admin = makeAddr("admin");
    address internal verifier;
    uint256 internal verifierKey;
    address internal supplier = makeAddr("supplier");
    address internal buyer = makeAddr("buyer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    uint128 internal constant FACE = 50_000e6;
    uint16 internal constant FEE_BPS = 100; // 1%
    uint40 internal constant GRACE = 30 days;
    uint40 internal constant WINDOW = 14 days;
    bytes32 internal constant DOCS = keccak256("invoice.pdf + bill-of-lading.pdf");

    function setUp() public {
        vm.warp(1_790_000_000); // Sept 2026
        (verifier, verifierKey) = makeAddrAndKey("verifier");
        usdg = new MockStablecoin("Global Dollar", "USDG");

        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        nft = new EarnXInvoiceNFT(IEarnX(predicted));
        protocol = new EarnXProtocol(admin, verifier, IEarnXInvoiceNFT(address(nft)), FEE_BPS, GRACE, WINDOW);
        assertEq(address(protocol), predicted);

        vm.prank(admin);
        protocol.configureToken(address(usdg), true, 1e6);

        address[4] memory wallets = [alice, bob, buyer, stranger];
        for (uint256 i; i < wallets.length; ++i) {
            usdg.mint(wallets[i], 1_000_000e6);
            vm.prank(wallets[i]);
            usdg.approve(address(protocol), type(uint256).max);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------------------------------

    function _params(uint128 face, uint40 tenor) internal view returns (IEarnX.SubmitParams memory) {
        return IEarnX.SubmitParams({
            token: address(usdg),
            faceValue: face,
            dueDate: uint40(block.timestamp) + tenor,
            buyer: "Kumasi Cocoa Processors Ltd",
            commodity: "Cocoa beans",
            origin: "Ghana",
            destination: "Netherlands",
            docsCID: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            docsHash: DOCS
        });
    }

    function _submit() internal returns (uint256 id) {
        vm.prank(supplier);
        id = protocol.submitInvoice(_params(FACE, 60 days));
    }

    function _submitAndVerify() internal returns (uint256 id) {
        id = _submit();
        vm.prank(verifier);
        protocol.verifyInvoice(id, 30, 1400, 9000); // 14% APR, 90% advance -> 45,000 target
    }

    function _fundFully(uint256 id) internal {
        vm.prank(alice);
        protocol.invest(id, 20_000e6);
        vm.prank(bob);
        protocol.invest(id, 25_000e6);
    }

    function _sign(IEarnX.Verification memory v, uint256 key) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                protocol.VERIFICATION_TYPEHASH(),
                v.invoiceId,
                v.docsHash,
                v.riskScore,
                v.aprBps,
                v.advanceBps,
                v.nonce,
                v.deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", protocol.domainSeparator(), structHash));
        (uint8 v_, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v_);
    }

    // ---------------------------------------------------------------------------------------------
    // submit
    // ---------------------------------------------------------------------------------------------

    function test_submit_storesInvoice() public {
        uint256 id = _submit();
        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        assertEq(id, 1);
        assertEq(inv.supplier, supplier);
        assertEq(inv.faceValue, FACE);
        assertEq(uint8(inv.status), uint8(IEarnX.Status.Submitted));
        assertEq(inv.docsHash, DOCS);
        assertEq(protocol.getSupplierInvoices(supplier).length, 1);
    }

    function test_submit_revertsForUnsupportedToken() public {
        IEarnX.SubmitParams memory p = _params(FACE, 60 days);
        p.token = address(0xdead);
        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.UnsupportedToken.selector, address(0xdead)));
        vm.prank(supplier);
        protocol.submitInvoice(p);
    }

    function test_submit_revertsForTenorOutOfRange() public {
        vm.startPrank(supplier);
        vm.expectRevert(EarnXProtocol.InvalidDueDate.selector);
        protocol.submitInvoice(_params(FACE, 3 days));
        vm.expectRevert(EarnXProtocol.InvalidDueDate.selector);
        protocol.submitInvoice(_params(FACE, 400 days));
        vm.stopPrank();
    }

    function test_submit_revertsWithoutDocuments() public {
        IEarnX.SubmitParams memory p = _params(FACE, 60 days);
        p.docsHash = bytes32(0);
        vm.expectRevert(EarnXProtocol.MissingField.selector);
        vm.prank(supplier);
        protocol.submitInvoice(p);
    }

    // ---------------------------------------------------------------------------------------------
    // verify
    // ---------------------------------------------------------------------------------------------

    function test_verify_opensFundingAndMintsSoulboundRecordToExporter() public {
        uint256 id = _submitAndVerify();
        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        assertEq(uint8(inv.status), uint8(IEarnX.Status.Funding));
        assertEq(inv.fundingTarget, 45_000e6);
        assertEq(inv.fundingDeadline, block.timestamp + WINDOW);
        assertEq(nft.ownerOf(id), supplier);
        assertTrue(nft.locked(id));

        vm.expectRevert(EarnXInvoiceNFT.Soulbound.selector);
        vm.prank(supplier);
        nft.transferFrom(supplier, stranger, id);
    }

    function test_verify_onlyVerifier() public {
        uint256 id = _submit();
        vm.expectRevert();
        vm.prank(stranger);
        protocol.verifyInvoice(id, 30, 1400, 9000);
    }

    function test_verify_rejectsRiskAboveLimitAndBadPricing() public {
        uint256 id = _submit();
        vm.startPrank(verifier);
        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.RiskTooHigh.selector, uint8(81)));
        protocol.verifyInvoice(id, 81, 1400, 9000);
        vm.expectRevert(EarnXProtocol.InvalidPricing.selector);
        protocol.verifyInvoice(id, 30, 6000, 9000);
        vm.expectRevert(EarnXProtocol.InvalidPricing.selector);
        protocol.verifyInvoice(id, 30, 1400, 9900);
        vm.stopPrank();
    }

    function test_verify_cannotVerifyTwice() public {
        uint256 id = _submitAndVerify();
        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.WrongStatus.selector, IEarnX.Status.Funding));
        vm.prank(verifier);
        protocol.verifyInvoice(id, 30, 1400, 9000);
    }

    function test_verifyWithSig_anyoneCanRelay() public {
        uint256 id = _submit();
        IEarnX.Verification memory v = IEarnX.Verification(id, DOCS, 25, 1200, 9000, 0, block.timestamp + 1 hours);
        vm.prank(stranger);
        protocol.verifyInvoiceWithSig(v, _sign(v, verifierKey));
        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        assertEq(uint8(inv.status), uint8(IEarnX.Status.Funding));
        assertEq(inv.aprBps, 1200);
        assertEq(protocol.nonces(verifier), 1);
    }

    function test_verifyWithSig_rejectsReplayWrongDocsWrongSignerAndExpiry() public {
        uint256 id1 = _submit();
        uint256 id2 = _submit();

        IEarnX.Verification memory v = IEarnX.Verification(id1, DOCS, 25, 1200, 9000, 0, block.timestamp + 1 hours);
        bytes memory sig = _sign(v, verifierKey);
        protocol.verifyInvoiceWithSig(v, sig);
        vm.expectRevert(); // nonce already used
        protocol.verifyInvoiceWithSig(v, sig);

        // Signatures are computed before expectRevert, which only watches the next external call.
        IEarnX.Verification memory wrongDocs =
            IEarnX.Verification(id2, keccak256("other"), 25, 1200, 9000, 1, block.timestamp + 1 hours);
        sig = _sign(wrongDocs, verifierKey);
        vm.expectRevert(EarnXProtocol.DocsMismatch.selector);
        protocol.verifyInvoiceWithSig(wrongDocs, sig);

        (address impostor, uint256 impostorKey) = makeAddrAndKey("impostor");
        IEarnX.Verification memory forged = IEarnX.Verification(id2, DOCS, 25, 1200, 9000, 0, block.timestamp + 1 hours);
        sig = _sign(forged, impostorKey);
        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.InvalidSigner.selector, impostor));
        protocol.verifyInvoiceWithSig(forged, sig);

        IEarnX.Verification memory late = IEarnX.Verification(id2, DOCS, 25, 1200, 9000, 1, block.timestamp - 1);
        sig = _sign(late, verifierKey);
        vm.expectRevert(EarnXProtocol.SignatureExpired.selector);
        protocol.verifyInvoiceWithSig(late, sig);

        // The nonce was not burned by any failed attempt, so a correct signature still works.
        IEarnX.Verification memory good = IEarnX.Verification(id2, DOCS, 25, 1200, 9000, 1, block.timestamp + 1 hours);
        sig = _sign(good, verifierKey);
        protocol.verifyInvoiceWithSig(good, sig);
        assertEq(protocol.nonces(verifier), 2);
    }

    function test_reject() public {
        uint256 id = _submit();
        vm.prank(verifier);
        protocol.rejectInvoice(id, "Bill of lading does not match invoice");
        assertEq(uint8(protocol.getInvoice(id).status), uint8(IEarnX.Status.Rejected));
        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.WrongStatus.selector, IEarnX.Status.Rejected));
        vm.prank(alice);
        protocol.invest(id, 1_000e6);
    }

    function test_riskEngine_overridesVerifierPricing() public {
        IRiskEngine engine = new MockRiskEngine();
        vm.prank(admin);
        protocol.setRiskEngine(engine);
        uint256 id = _submit();
        vm.prank(verifier);
        protocol.verifyInvoice(id, 40, 1, 1); // proposed pricing is ignored
        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        assertEq(inv.aprBps, 800 + 40 * 20);
        assertEq(inv.advanceBps, 9000 - 40 * 25);
    }

    // ---------------------------------------------------------------------------------------------
    // invest + disbursement
    // ---------------------------------------------------------------------------------------------

    function test_invest_fullyFundedInvoicePaysExporterInSameTx() public {
        uint256 id = _submitAndVerify();
        vm.prank(alice);
        protocol.invest(id, 20_000e6);
        assertEq(usdg.balanceOf(supplier), 0);

        vm.prank(bob);
        protocol.invest(id, 25_000e6);

        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        uint256 fee = uint256(45_000e6) * FEE_BPS / 10_000;
        assertEq(uint8(inv.status), uint8(IEarnX.Status.Funded));
        assertEq(usdg.balanceOf(supplier), 45_000e6 - fee);
        assertEq(protocol.reserves(address(usdg)), fee);
        uint256 interest = uint256(45_000e6) * 1400 * 60 days / (10_000 * 365 days);
        assertEq(inv.repaymentDue, 45_000e6 + interest);
        assertEq(protocol.totalFunded(address(usdg)), 45_000e6);
        assertEq(protocol.fundedCount(), 1);
        assertEq(protocol.getInvestors(id).length, 2);
    }

    function test_invest_capsAtRemainingAmount() public {
        uint256 id = _submitAndVerify();
        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        uint256 accepted = protocol.invest(id, 100_000e6);
        assertEq(accepted, 45_000e6);
        assertEq(before - usdg.balanceOf(alice), 45_000e6);
        assertEq(protocol.positionOf(id, alice), 45_000e6);
    }

    function test_invest_guards() public {
        uint256 id = _submitAndVerify();

        vm.expectRevert(EarnXProtocol.SupplierCannotInvest.selector);
        vm.prank(supplier);
        protocol.invest(id, 1_000e6);

        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.BelowMinimum.selector, 1e6));
        vm.prank(alice);
        protocol.invest(id, 0.5e6);

        vm.warp(block.timestamp + WINDOW + 1);
        vm.expectRevert(EarnXProtocol.FundingClosed.selector);
        vm.prank(alice);
        protocol.invest(id, 1_000e6);
    }

    function test_invest_lastPieceMayBeBelowMinimum() public {
        uint256 id = _submitAndVerify();
        vm.prank(alice);
        protocol.invest(id, 45_000e6 - 0.5e6);
        vm.prank(bob);
        protocol.invest(id, 0.5e6);
        assertEq(uint8(protocol.getInvoice(id).status), uint8(IEarnX.Status.Funded));
    }

    function test_whenPaused_noNewInvestments() public {
        uint256 id = _submitAndVerify();
        vm.prank(admin);
        protocol.pause();
        vm.expectRevert();
        vm.prank(alice);
        protocol.invest(id, 1_000e6);
    }

    // ---------------------------------------------------------------------------------------------
    // cancel + refunds
    // ---------------------------------------------------------------------------------------------

    function test_cancel_afterFundingWindowAnyoneCanCancelAndInvestorsGetRefunds() public {
        uint256 id = _submitAndVerify();
        vm.prank(alice);
        protocol.invest(id, 10_000e6);

        vm.expectRevert(EarnXProtocol.NotAuthorized.selector);
        vm.prank(stranger);
        protocol.cancelInvoice(id);

        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(stranger);
        protocol.cancelInvoice(id);

        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        protocol.claim(id);
        assertEq(usdg.balanceOf(alice) - before, 10_000e6);

        vm.expectRevert(EarnXProtocol.NothingToClaim.selector);
        vm.prank(alice);
        protocol.claim(id);
    }

    function test_cancel_byExporterBeforeFunding() public {
        uint256 id = _submit();
        vm.prank(supplier);
        protocol.cancelInvoice(id);
        assertEq(uint8(protocol.getInvoice(id).status), uint8(IEarnX.Status.Cancelled));
    }

    // ---------------------------------------------------------------------------------------------
    // repay + claim
    // ---------------------------------------------------------------------------------------------

    function test_repay_inFull_investorsClaimPrincipalPlusYieldProRata() public {
        uint256 id = _submitAndVerify();
        _fundFully(id);
        uint256 due = protocol.getInvoice(id).repaymentDue;

        vm.warp(block.timestamp + 60 days);
        vm.prank(buyer);
        protocol.repay(id, type(uint256).max); // capped at what is owed
        assertEq(uint8(protocol.getInvoice(id).status), uint8(IEarnX.Status.Repaid));
        assertEq(protocol.repaidCount(), 1);

        uint256 a0 = usdg.balanceOf(alice);
        uint256 b0 = usdg.balanceOf(bob);
        vm.prank(alice);
        protocol.claim(id);
        vm.prank(bob);
        protocol.claim(id);
        uint256 aliceGot = usdg.balanceOf(alice) - a0;
        uint256 bobGot = usdg.balanceOf(bob) - b0;

        assertEq(aliceGot, due * 20_000e6 / 45_000e6);
        assertEq(bobGot, due * 25_000e6 / 45_000e6);
        assertGt(aliceGot, 20_000e6); // earned yield
        assertLe(aliceGot + bobGot, due);
    }

    function test_repay_inParts_investorsCanClaimAsMoneyArrives() public {
        uint256 id = _submitAndVerify();
        _fundFully(id);
        uint256 due = protocol.getInvoice(id).repaymentDue;

        vm.prank(buyer);
        protocol.repay(id, 9_000e6);
        vm.prank(alice);
        uint256 first = protocol.claim(id);
        assertEq(first, 9_000e6 * 20_000e6 / 45_000e6);

        vm.prank(supplier);
        usdg.approve(address(protocol), type(uint256).max);
        usdg.mint(supplier, due);
        vm.prank(supplier);
        protocol.repay(id, due - 9_000e6);

        vm.prank(alice);
        uint256 second = protocol.claim(id);
        assertEq(first + second, due * 20_000e6 / 45_000e6);
    }

    function test_repay_revertsBeforeFunding() public {
        uint256 id = _submitAndVerify();
        vm.expectRevert(abi.encodeWithSelector(EarnXProtocol.WrongStatus.selector, IEarnX.Status.Funding));
        vm.prank(buyer);
        protocol.repay(id, 1_000e6);
    }

    // ---------------------------------------------------------------------------------------------
    // default + reserve
    // ---------------------------------------------------------------------------------------------

    function test_default_onlyAfterDueDatePlusGrace() public {
        uint256 id = _submitAndVerify();
        _fundFully(id);
        vm.warp(protocol.getInvoice(id).dueDate + GRACE);
        vm.expectRevert(EarnXProtocol.NotDueForDefault.selector);
        protocol.markDefault(id);
        vm.warp(block.timestamp + 1);
        protocol.markDefault(id);
        assertEq(uint8(protocol.getInvoice(id).status), uint8(IEarnX.Status.Defaulted));
    }

    function test_default_reserveCoversInvestorPrincipal() public {
        vm.prank(stranger); // e.g. a development-finance partner providing first-loss capital
        protocol.fundReserve(address(usdg), 100_000e6);

        uint256 id = _submitAndVerify();
        _fundFully(id);
        vm.prank(buyer);
        protocol.repay(id, 5_000e6);

        vm.warp(protocol.getInvoice(id).dueDate + GRACE + 1);
        protocol.markDefault(id);

        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        assertEq(inv.reserveCover, 40_000e6); // principal shortfall 45k - 5k
        uint256 a0 = usdg.balanceOf(alice);
        vm.prank(alice);
        protocol.claim(id);
        assertEq(usdg.balanceOf(alice) - a0, 20_000e6); // principal back in full
    }

    function test_default_reserveCoverIsLimitedByReserveSize() public {
        uint256 id = _submitAndVerify();
        _fundFully(id);
        uint256 fee = uint256(45_000e6) * FEE_BPS / 10_000;

        vm.warp(protocol.getInvoice(id).dueDate + GRACE + 1);
        protocol.markDefault(id);
        assertEq(protocol.getInvoice(id).reserveCover, fee);
        assertEq(protocol.reserves(address(usdg)), 0);
        assertEq(protocol.claimable(id, alice), fee * 20_000e6 / 45_000e6);
    }

    function test_recoveryAfterDefault_paysInvestorsThenRefillsReserve() public {
        vm.prank(stranger);
        protocol.fundReserve(address(usdg), 100_000e6);
        uint256 id = _submitAndVerify();
        _fundFully(id);
        uint256 due = protocol.getInvoice(id).repaymentDue;

        vm.warp(protocol.getInvoice(id).dueDate + GRACE + 1);
        protocol.markDefault(id);
        uint256 reserveAfterDefault = protocol.reserves(address(usdg));

        vm.prank(buyer);
        protocol.repay(id, due); // the buyer finally pays in full

        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        assertEq(uint8(inv.status), uint8(IEarnX.Status.Repaid));
        assertEq(inv.reserveCover, 0);
        assertEq(protocol.reserves(address(usdg)), reserveAfterDefault + 45_000e6);
        assertEq(protocol.claimable(id, alice) + protocol.claimable(id, bob), due - 1); // 1 unit rounding dust
    }

    // ---------------------------------------------------------------------------------------------
    // metadata
    // ---------------------------------------------------------------------------------------------

    function test_tokenURI_isOnChainJson() public {
        uint256 id = _submitAndVerify();
        string memory uri = nft.tokenURI(id);
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
    }

    function _prefix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) out[i] = b[i];
        return string(out);
    }

    // ---------------------------------------------------------------------------------------------
    // fuzz
    // ---------------------------------------------------------------------------------------------

    /// Whatever the split between investors and however much comes back, investors are paid
    /// exactly their pro-rata share and the protocol always holds enough to pay every claim.
    function testFuzz_claimsAreProRataAndProtocolStaysSolvent(
        uint256 aliceShare,
        uint256 repaidAmount,
        bool defaults,
        uint256 extraReserve
    ) public {
        extraReserve = bound(extraReserve, 0, 60_000e6);
        if (extraReserve > 0) {
            vm.prank(stranger);
            protocol.fundReserve(address(usdg), extraReserve);
        }
        uint256 id = _submitAndVerify();
        uint256 target = protocol.getInvoice(id).fundingTarget;
        aliceShare = bound(aliceShare, 1e6, target - 1e6);
        vm.prank(alice);
        protocol.invest(id, aliceShare);
        vm.prank(bob);
        protocol.invest(id, target - aliceShare);

        uint256 due = protocol.getInvoice(id).repaymentDue;
        repaidAmount = bound(repaidAmount, 0, due);
        if (repaidAmount > 0) {
            vm.prank(buyer);
            protocol.repay(id, repaidAmount);
        }
        if (defaults && repaidAmount < due) {
            vm.warp(protocol.getInvoice(id).dueDate + GRACE + 1);
            protocol.markDefault(id);
        }

        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        uint256 distributable = uint256(inv.repaid) + inv.reserveCover;
        uint256 aliceOwed = protocol.claimable(id, alice);
        uint256 bobOwed = protocol.claimable(id, bob);
        assertEq(aliceOwed, distributable * aliceShare / target);
        assertLe(aliceOwed + bobOwed, distributable);
        assertGe(usdg.balanceOf(address(protocol)), protocol.reserves(address(usdg)) + aliceOwed + bobOwed);
    }

    function testFuzz_interestNeverExceedsAprOverTenor(uint16 aprBps, uint40 tenor) public {
        aprBps = uint16(bound(aprBps, 1, 5_000));
        tenor = uint40(bound(tenor, 8 days, 365 days));
        vm.prank(supplier);
        uint256 id = protocol.submitInvoice(_params(FACE, tenor));
        vm.prank(verifier);
        protocol.verifyInvoice(id, 30, aprBps, 9000);
        vm.prank(alice);
        protocol.invest(id, type(uint256).max);

        IEarnX.Invoice memory inv = protocol.getInvoice(id);
        uint256 maxInterest = uint256(inv.funded) * aprBps * tenor / (10_000 * 365 days);
        assertLe(inv.repaymentDue - inv.funded, maxInterest);
    }
}
