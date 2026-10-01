// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IEarnX} from "./interfaces/IEarnX.sol";
import {IRiskEngine} from "./interfaces/IRiskEngine.sol";

interface IEarnXInvoiceNFT {
    function mint(address to, uint256 tokenId) external;
}

/// @title EarnX invoice-financing protocol
/// @notice Exporters submit invoices, a verifier checks the documents and prices the risk, investors
/// fund the invoice in a stablecoin, and the exporter is paid automatically the moment it is fully
/// funded. Repayments are shared pro-rata between investors. A first-loss reserve, filled by protocol
/// fees and by anyone who wants to back exporters, covers investor principal if an invoice defaults.
contract EarnXProtocol is IEarnX, AccessControl, EIP712, Nonces, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant VERIFICATION_TYPEHASH = keccak256(
        "Verification(uint256 invoiceId,bytes32 docsHash,uint8 riskScore,uint16 aprBps,uint16 advanceBps,uint256 nonce,uint256 deadline)"
    );

    uint256 public constant BPS = 10_000;
    uint256 public constant MIN_TENOR = 7 days;
    uint256 public constant MAX_TENOR = 365 days;
    uint16 public constant MAX_APR_BPS = 5_000;
    uint16 public constant MIN_ADVANCE_BPS = 1_000;
    uint16 public constant MAX_ADVANCE_BPS = 9_500;
    uint8 public constant MAX_FUNDABLE_RISK = 80;
    uint16 public constant MAX_FEE_BPS = 500;
    uint40 public constant MAX_GRACE_PERIOD = 90 days;
    uint40 public constant MAX_FUNDING_WINDOW = 60 days;

    IEarnXInvoiceNFT public immutable invoiceNFT;
    IRiskEngine public riskEngine;

    uint16 public protocolFeeBps;
    uint40 public gracePeriod;
    uint40 public fundingWindow;

    mapping(address token => bool) public isTokenAllowed;
    mapping(address token => uint256) public minInvestment;
    mapping(address token => uint256) public reserves;
    mapping(address token => uint256) public totalFunded;
    mapping(address token => uint256) public totalRepaid;

    uint256 public invoiceCount;
    uint256 public fundedCount;
    uint256 public repaidCount;
    uint256 public defaultedCount;

    mapping(uint256 id => Invoice) private _invoices;
    mapping(uint256 id => address[]) private _investors;
    mapping(uint256 id => mapping(address investor => uint256)) public positionOf;
    mapping(uint256 id => mapping(address investor => uint256)) public claimedOf;
    mapping(address supplier => uint256[]) private _supplierInvoices;
    mapping(address investor => uint256[]) private _investorInvoices;

    event InvoiceSubmitted(
        uint256 indexed id,
        address indexed supplier,
        address indexed token,
        uint256 faceValue,
        uint256 dueDate,
        bytes32 docsHash,
        string docsCID
    );
    event InvoiceVerified(
        uint256 indexed id,
        address indexed verifier,
        uint8 riskScore,
        uint16 aprBps,
        uint16 advanceBps,
        uint256 fundingTarget,
        uint256 fundingDeadline
    );
    event InvoiceRejected(uint256 indexed id, address indexed verifier, string reason);
    event InvoiceCancelled(uint256 indexed id, address indexed by);
    event Invested(uint256 indexed id, address indexed investor, uint256 amount, uint256 totalFunded);
    event InvoiceFunded(
        uint256 indexed id, address indexed supplier, uint256 disbursed, uint256 fee, uint256 repaymentDue
    );
    event RepaymentMade(uint256 indexed id, address indexed payer, uint256 amount, uint256 totalRepaid);
    event InvoiceRepaid(uint256 indexed id);
    event InvoiceDefaulted(uint256 indexed id, uint256 outstanding, uint256 reserveCover);
    event ReserveReimbursed(uint256 indexed id, uint256 amount);
    event Claimed(uint256 indexed id, address indexed investor, uint256 amount);
    event ReserveFunded(address indexed token, address indexed from, uint256 amount);
    event TokenConfigured(address indexed token, bool allowed, uint256 minInvestment);
    event ParamsUpdated(uint16 protocolFeeBps, uint40 gracePeriod, uint40 fundingWindow);
    event RiskEngineUpdated(address indexed engine);

    error UnknownInvoice(uint256 id);
    error UnsupportedToken(address token);
    error InvalidAmount();
    error InvalidDueDate();
    error MissingField();
    error WrongStatus(Status current);
    error InvalidPricing();
    error RiskTooHigh(uint8 riskScore);
    error FundingClosed();
    error SupplierCannotInvest();
    error BelowMinimum(uint256 minimum);
    error NotDueForDefault();
    error NothingToClaim();
    error NotAuthorized();
    error SignatureExpired();
    error InvalidSigner(address signer);
    error DocsMismatch();
    error InvalidParam();

    constructor(
        address admin,
        address verifier,
        IEarnXInvoiceNFT nft,
        uint16 feeBps,
        uint40 grace,
        uint40 window
    ) EIP712("EarnX", "1") {
        if (admin == address(0) || address(nft) == address(0)) revert InvalidParam();
        invoiceNFT = nft;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (verifier != address(0)) _grantRole(VERIFIER_ROLE, verifier);
        _setParams(feeBps, grace, window);
    }

    // ---------------------------------------------------------------------------------------------
    // Exporter
    // ---------------------------------------------------------------------------------------------

    function submitInvoice(SubmitParams calldata p) external whenNotPaused returns (uint256 id) {
        if (!isTokenAllowed[p.token]) revert UnsupportedToken(p.token);
        if (p.faceValue == 0) revert InvalidAmount();
        if (p.dueDate < block.timestamp + MIN_TENOR || p.dueDate > block.timestamp + MAX_TENOR) {
            revert InvalidDueDate();
        }
        if (bytes(p.buyer).length == 0 || bytes(p.commodity).length == 0 || p.docsHash == bytes32(0)) {
            revert MissingField();
        }

        id = ++invoiceCount;
        Invoice storage inv = _invoices[id];
        inv.id = uint64(id);
        inv.status = Status.Submitted;
        inv.submittedAt = uint40(block.timestamp);
        inv.dueDate = p.dueDate;
        inv.supplier = msg.sender;
        inv.token = p.token;
        inv.faceValue = p.faceValue;
        inv.docsHash = p.docsHash;
        inv.docsCID = p.docsCID;
        inv.buyer = p.buyer;
        inv.commodity = p.commodity;
        inv.origin = p.origin;
        inv.destination = p.destination;
        _supplierInvoices[msg.sender].push(id);

        emit InvoiceSubmitted(id, msg.sender, p.token, p.faceValue, p.dueDate, p.docsHash, p.docsCID);
    }

    /// @notice The exporter (or a verifier) can withdraw an invoice before it is fully funded. Anyone
    /// can cancel one whose funding window closed without reaching the target. Investors then claim
    /// their money back with `claim`.
    function cancelInvoice(uint256 id) external {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Submitted && inv.status != Status.Funding) revert WrongStatus(inv.status);
        bool expired = inv.status == Status.Funding && block.timestamp > inv.fundingDeadline;
        if (msg.sender != inv.supplier && !hasRole(VERIFIER_ROLE, msg.sender) && !expired) {
            revert NotAuthorized();
        }
        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    // ---------------------------------------------------------------------------------------------
    // Verifier
    // ---------------------------------------------------------------------------------------------

    function verifyInvoice(uint256 id, uint8 riskScore, uint16 aprBps, uint16 advanceBps)
        external
        onlyRole(VERIFIER_ROLE)
        whenNotPaused
    {
        _verify(id, riskScore, aprBps, advanceBps, msg.sender);
    }

    /// @notice Lets an off-chain verifier (a person or an agent) approve an invoice by signature, so
    /// anyone can relay it. The signature is bound to the exact document hash the verifier reviewed.
    function verifyInvoiceWithSig(Verification calldata v, bytes calldata signature) external whenNotPaused {
        if (block.timestamp > v.deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(
            abi.encode(
                VERIFICATION_TYPEHASH,
                v.invoiceId,
                v.docsHash,
                v.riskScore,
                v.aprBps,
                v.advanceBps,
                v.nonce,
                v.deadline
            )
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (!hasRole(VERIFIER_ROLE, signer)) revert InvalidSigner(signer);
        _useCheckedNonce(signer, v.nonce);
        if (_invoice(v.invoiceId).docsHash != v.docsHash) revert DocsMismatch();
        _verify(v.invoiceId, v.riskScore, v.aprBps, v.advanceBps, signer);
    }

    function rejectInvoice(uint256 id, string calldata reason) external onlyRole(VERIFIER_ROLE) {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Submitted) revert WrongStatus(inv.status);
        inv.status = Status.Rejected;
        emit InvoiceRejected(id, msg.sender, reason);
    }

    function _verify(uint256 id, uint8 riskScore, uint16 aprBps, uint16 advanceBps, address verifier)
        internal
    {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Submitted) revert WrongStatus(inv.status);
        if (riskScore > MAX_FUNDABLE_RISK) revert RiskTooHigh(riskScore);

        uint256 lastFundingDay = uint256(inv.dueDate) - 1 days;
        if (lastFundingDay <= block.timestamp) revert InvalidDueDate();
        uint256 deadline = Math.min(block.timestamp + fundingWindow, lastFundingDay);

        if (address(riskEngine) != address(0)) {
            uint32 tenorDays = uint32((uint256(inv.dueDate) - block.timestamp) / 1 days);
            (aprBps, advanceBps) = riskEngine.quote(riskScore, tenorDays, inv.faceValue);
        }
        if (aprBps == 0 || aprBps > MAX_APR_BPS || advanceBps < MIN_ADVANCE_BPS || advanceBps > MAX_ADVANCE_BPS) {
            revert InvalidPricing();
        }
        uint128 target = uint128(uint256(inv.faceValue) * advanceBps / BPS);
        if (target == 0) revert InvalidAmount();

        inv.status = Status.Funding;
        inv.riskScore = riskScore;
        inv.aprBps = aprBps;
        inv.advanceBps = advanceBps;
        inv.fundingTarget = target;
        inv.fundingDeadline = uint40(deadline);

        // The exporter keeps a non-transferable record of every verified invoice: an on-chain
        // trade history that grows with each repayment.
        invoiceNFT.mint(inv.supplier, id);

        emit InvoiceVerified(id, verifier, riskScore, aprBps, advanceBps, target, deadline);
    }

    // ---------------------------------------------------------------------------------------------
    // Investor
    // ---------------------------------------------------------------------------------------------

    /// @notice Fund part or all of an invoice. Amounts above what is still needed are capped.
    /// When the target is reached, the exporter is paid in the same transaction.
    function invest(uint256 id, uint256 amount) external nonReentrant whenNotPaused returns (uint256 accepted) {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Funding) revert WrongStatus(inv.status);
        if (block.timestamp > inv.fundingDeadline) revert FundingClosed();
        if (msg.sender == inv.supplier) revert SupplierCannotInvest();

        uint256 remaining = inv.fundingTarget - inv.funded;
        accepted = Math.min(amount, remaining);
        if (accepted == 0) revert InvalidAmount();
        uint256 minimum = minInvestment[inv.token];
        if (accepted < minimum && accepted != remaining) revert BelowMinimum(minimum);

        if (positionOf[id][msg.sender] == 0) {
            _investors[id].push(msg.sender);
            _investorInvoices[msg.sender].push(id);
        }
        positionOf[id][msg.sender] += accepted;
        inv.funded += uint128(accepted);

        IERC20(inv.token).safeTransferFrom(msg.sender, address(this), accepted);
        emit Invested(id, msg.sender, accepted, inv.funded);

        if (inv.funded == inv.fundingTarget) _disburse(id, inv);
    }

    /// @notice Withdraw what an invoice owes you: your share of repayments (plus any reserve cover
    /// after a default), or your full principal if the invoice was cancelled before funding.
    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        amount = claimable(id, msg.sender);
        if (amount == 0) revert NothingToClaim();
        claimedOf[id][msg.sender] += amount;
        IERC20(_invoices[id].token).safeTransfer(msg.sender, amount);
        emit Claimed(id, msg.sender, amount);
    }

    function claimable(uint256 id, address investor) public view returns (uint256) {
        uint256 position = positionOf[id][investor];
        if (position == 0) return 0;
        Invoice storage inv = _invoices[id];

        uint256 entitled;
        if (inv.status == Status.Cancelled) {
            entitled = position;
        } else if (inv.status == Status.Funded || inv.status == Status.Repaid || inv.status == Status.Defaulted) {
            entitled = Math.mulDiv(uint256(inv.repaid) + inv.reserveCover, position, inv.funded);
        } else {
            return 0;
        }
        uint256 alreadyClaimed = claimedOf[id][investor];
        return entitled > alreadyClaimed ? entitled - alreadyClaimed : 0;
    }

    // ---------------------------------------------------------------------------------------------
    // Repayment and default
    // ---------------------------------------------------------------------------------------------

    /// @notice Anyone (buyer, exporter, or a collection agent) can repay, in one go or in parts.
    /// Repayments after a default are still accepted and first pay back the reserve.
    function repay(uint256 id, uint256 amount) external nonReentrant returns (uint256 accepted) {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Funded && inv.status != Status.Defaulted) revert WrongStatus(inv.status);

        accepted = Math.min(amount, inv.repaymentDue - inv.repaid);
        if (accepted == 0) revert InvalidAmount();
        inv.repaid += uint128(accepted);
        totalRepaid[inv.token] += accepted;

        uint256 distributable = uint256(inv.repaid) + inv.reserveCover;
        if (distributable > inv.repaymentDue) {
            uint256 reimbursed = distributable - inv.repaymentDue;
            inv.reserveCover -= uint128(reimbursed);
            reserves[inv.token] += reimbursed;
            emit ReserveReimbursed(id, reimbursed);
        }
        if (inv.repaid == inv.repaymentDue) {
            inv.status = Status.Repaid;
            repaidCount++;
            emit InvoiceRepaid(id);
        }

        IERC20(inv.token).safeTransferFrom(msg.sender, address(this), accepted);
        emit RepaymentMade(id, msg.sender, accepted, inv.repaid);
    }

    /// @notice After the due date plus the grace period, anyone can mark an unpaid invoice as
    /// defaulted. The reserve then covers as much of the investors' unpaid principal as it can.
    function markDefault(uint256 id) external {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Funded) revert WrongStatus(inv.status);
        if (block.timestamp <= uint256(inv.dueDate) + gracePeriod) revert NotDueForDefault();

        inv.status = Status.Defaulted;
        defaultedCount++;
        uint256 principalShortfall = inv.funded > inv.repaid ? inv.funded - inv.repaid : 0;
        uint256 cover = Math.min(reserves[inv.token], principalShortfall);
        reserves[inv.token] -= cover;
        inv.reserveCover = uint128(cover);

        emit InvoiceDefaulted(id, inv.repaymentDue - inv.repaid, cover);
    }

    /// @notice Add first-loss capital. It can only ever be used to cover investor losses.
    function fundReserve(address token, uint256 amount) external nonReentrant {
        if (!isTokenAllowed[token]) revert UnsupportedToken(token);
        if (amount == 0) revert InvalidAmount();
        reserves[token] += amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(token, msg.sender, amount);
    }

    function _disburse(uint256 id, Invoice storage inv) internal {
        uint256 principal = inv.funded;
        uint256 interest =
            Math.mulDiv(principal, uint256(inv.aprBps) * (uint256(inv.dueDate) - block.timestamp), BPS * 365 days);
        uint256 fee = principal * protocolFeeBps / BPS;

        inv.status = Status.Funded;
        inv.fundedAt = uint40(block.timestamp);
        inv.repaymentDue = SafeCast.toUint128(principal + interest);
        reserves[inv.token] += fee;
        totalFunded[inv.token] += principal;
        fundedCount++;

        IERC20(inv.token).safeTransfer(inv.supplier, principal - fee);
        emit InvoiceFunded(id, inv.supplier, principal - fee, fee, inv.repaymentDue);
    }

    // ---------------------------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------------------------

    function configureToken(address token, bool allowed, uint256 minimum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert InvalidParam();
        isTokenAllowed[token] = allowed;
        minInvestment[token] = minimum;
        emit TokenConfigured(token, allowed, minimum);
    }

    function setParams(uint16 feeBps, uint40 grace, uint40 window) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setParams(feeBps, grace, window);
    }

    function setRiskEngine(IRiskEngine engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        riskEngine = engine;
        emit RiskEngineUpdated(address(engine));
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _setParams(uint16 feeBps, uint40 grace, uint40 window) internal {
        if (feeBps > MAX_FEE_BPS || grace > MAX_GRACE_PERIOD || window < 1 days || window > MAX_FUNDING_WINDOW) {
            revert InvalidParam();
        }
        protocolFeeBps = feeBps;
        gracePeriod = grace;
        fundingWindow = window;
        emit ParamsUpdated(feeBps, grace, window);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    function getInvoice(uint256 id) external view returns (Invoice memory) {
        return _invoice(id);
    }

    /// @notice Page through invoices by id (ids start at 1), so a frontend can load the book in one call.
    function getInvoices(uint256 fromId, uint256 limit) external view returns (Invoice[] memory page) {
        if (fromId == 0) fromId = 1;
        if (fromId > invoiceCount) return page;
        uint256 toId = Math.min(invoiceCount, fromId + limit - 1);
        page = new Invoice[](toId - fromId + 1);
        for (uint256 i; i < page.length; ++i) {
            page[i] = _invoices[fromId + i];
        }
    }

    function getInvestors(uint256 id) external view returns (address[] memory) {
        return _investors[id];
    }

    function getSupplierInvoices(address supplier) external view returns (uint256[] memory) {
        return _supplierInvoices[supplier];
    }

    function getInvestorInvoices(address investor) external view returns (uint256[] memory) {
        return _investorInvoices[investor];
    }

    function outstanding(uint256 id) external view returns (uint256) {
        Invoice storage inv = _invoice(id);
        if (inv.status != Status.Funded && inv.status != Status.Defaulted) return 0;
        return inv.repaymentDue - inv.repaid;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _invoice(uint256 id) internal view returns (Invoice storage) {
        if (id == 0 || id > invoiceCount) revert UnknownInvoice(id);
        return _invoices[id];
    }
}
