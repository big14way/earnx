// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interface for ERC20 token (USDC)
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title SimpleEarnXProtocol
 * @notice Simplified EarnX protocol without CCIP for faster transactions
 * @dev Minimal version for hackathon demo - NOW WITH REAL USDC TRANSFERS
 */
contract SimpleEarnXProtocol {

    // ============ STATE VARIABLES ============
    address public owner;
    uint256 public invoiceCounter;
    bool public paused;
    uint256 public constant FUNDING_PERCENTAGE = 9000; // 90% of invoice value
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;

    // USDC token contract address
    IERC20 public usdcToken;

    // ============ STRUCTS ============
    struct Invoice {
        uint256 id;
        address supplier;
        address buyer;
        uint256 amount;
        string commodity;
        string supplierCountry;
        string buyerCountry;
        string exporterName;
        string buyerName;
        uint256 dueDate;
        uint256 aprBasisPoints;
        InvoiceStatus status;
        uint256 createdAt;
        bool documentVerified;
        uint256 targetFunding;
        uint256 currentFunding;
        string documentHash;
        uint256 riskScore;
        string creditRating;
    }

    enum InvoiceStatus {
        Submitted,       // 0 - Just submitted
        Verifying,       // 1 - Under verification
        Verified,        // 2 - Verified, open for investment
        FullyFunded,     // 3 - Investment target reached
        Approved,        // 4 - APR calculated, ready to fund
        Funded,          // 5 - Funds transferred to supplier
        Repaid,          // 6 - Buyer has repaid
        Defaulted,       // 7 - Payment overdue
        Rejected         // 8 - Failed verification
    }

    // Investment tracking
    struct Investment {
        address investor;
        uint256 amount;
        uint256 timestamp;
    }

    // ============ STORAGE ============
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) public supplierInvoices;
    mapping(address => uint256[]) public buyerInvoices;
    mapping(uint256 => Investment[]) public invoiceInvestments;
    mapping(address => uint256[]) public investorInvoices;

    // ============ EVENTS ============
    event InvoiceSubmitted(
        uint256 indexed invoiceId,
        address indexed supplier,
        address indexed buyer,
        uint256 amount,
        uint256 targetFunding,
        string commodity
    );
    event InvoiceVerified(uint256 indexed invoiceId, uint256 aprBasisPoints, uint256 riskScore, string creditRating);
    event InvoiceRejected(uint256 indexed invoiceId, string reason);
    event InvestmentMade(uint256 indexed invoiceId, address indexed investor, uint256 amount, uint256 newTotal);
    event InvoiceFullyFunded(uint256 indexed invoiceId, uint256 totalAmount);
    event ProtocolPaused(bool paused);

    // ============ MODIFIERS ============
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Protocol is paused");
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(address _usdcToken) {
        owner = msg.sender;
        usdcToken = IERC20(_usdcToken);
    }

    // Allow owner to set USDC token address (for upgrades)
    function setUSDCToken(address _usdcToken) external onlyOwner {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    // ============ INVOICE SUBMISSION ============
    function submitInvoice(
        address buyer,
        uint256 amount,
        string memory commodity,
        string memory supplierCountry,
        string memory buyerCountry,
        string memory exporterName,
        string memory buyerName,
        uint256 dueDate,
        string memory documentHash
    ) external notPaused returns (uint256) {
        require(buyer != address(0), "Invalid buyer address");
        require(buyer != msg.sender, "Supplier cannot be buyer");
        require(amount > 0, "Amount must be positive");
        require(dueDate > block.timestamp + 7 days, "Due date must be at least 7 days in future");
        require(bytes(commodity).length > 0, "Commodity required");
        require(bytes(exporterName).length > 0, "Exporter name required");
        require(bytes(buyerName).length > 0, "Buyer name required");
        require(bytes(documentHash).length > 0, "Document hash required");
        require(bytes(supplierCountry).length > 0, "Supplier country required");
        require(bytes(buyerCountry).length > 0, "Buyer country required");

        invoiceCounter++;
        uint256 invoiceId = invoiceCounter;
        uint256 targetFunding = (amount * FUNDING_PERCENTAGE) / BASIS_POINTS_DENOMINATOR;

        // Create invoice in storage
        Invoice storage newInvoice = invoices[invoiceId];
        newInvoice.id = invoiceId;
        newInvoice.supplier = msg.sender;
        newInvoice.buyer = buyer;
        newInvoice.amount = amount;
        newInvoice.commodity = commodity;
        newInvoice.supplierCountry = supplierCountry;
        newInvoice.buyerCountry = buyerCountry;
        newInvoice.exporterName = exporterName;
        newInvoice.buyerName = buyerName;
        newInvoice.dueDate = dueDate;
        newInvoice.aprBasisPoints = 0;
        newInvoice.status = InvoiceStatus.Submitted;
        newInvoice.createdAt = block.timestamp;
        newInvoice.documentVerified = false;
        newInvoice.targetFunding = targetFunding;
        newInvoice.currentFunding = 0;
        newInvoice.documentHash = documentHash;

        supplierInvoices[msg.sender].push(invoiceId);
        buyerInvoices[buyer].push(invoiceId);

        emit InvoiceSubmitted(invoiceId, msg.sender, buyer, amount, targetFunding, commodity);

        // Auto-verify the invoice (simplified for demo)
        _autoVerify(invoiceId, commodity, amount, supplierCountry);

        return invoiceId;
    }

    // ============ AUTO VERIFICATION ============
    function _autoVerify(
        uint256 invoiceId,
        string memory commodity,
        uint256 amount,
        string memory supplierCountry
    ) internal {
        Invoice storage invoice = invoices[invoiceId];

        bool valid = true;
        uint256 risk = 25; // Default low risk
        string memory rating = "A";

        // Simple risk assessment heuristics
        bytes32 commodityHash = keccak256(bytes(_toLower(commodity)));

        if (commodityHash == keccak256(bytes("gold")) ||
            commodityHash == keccak256(bytes("coffee")) ||
            commodityHash == keccak256(bytes("cocoa")) ||
            commodityHash == keccak256(bytes("tea"))) {
            risk = 20; // Lower risk for established commodities
            rating = "AA";
        } else if (commodityHash == keccak256(bytes("cassava")) ||
                   commodityHash == keccak256(bytes("spices")) ||
                   commodityHash == keccak256(bytes("cotton"))) {
            risk = 30; // Medium risk
            rating = "A";
        } else {
            risk = 35;
            rating = "B";
        }

        // Amount-based risk adjustment
        if (amount > 100000 * 10**6) { // > $100k (assuming 6 decimals)
            risk += 10;
        }

        // Country-based risk (simplified)
        bytes32 countryHash = keccak256(bytes(_toLower(supplierCountry)));
        if (countryHash == keccak256(bytes("kenya")) ||
            countryHash == keccak256(bytes("ghana")) ||
            countryHash == keccak256(bytes("nigeria")) ||
            countryHash == keccak256(bytes("south africa"))) {
            // Known trade countries - lower risk
            if (risk > 5) risk -= 5;
        }

        // Ensure risk stays within bounds
        if (risk > 75) {
            valid = false;
            risk = 85;
            rating = "D";
        } else if (risk > 50) {
            rating = "C";
        } else if (risk > 35) {
            rating = "B";
        }

        // Store results
        invoice.documentVerified = valid;
        invoice.riskScore = risk;
        invoice.creditRating = rating;

        if (valid) {
            // Calculate APR based on risk score (8-20% range)
            uint256 baseAPR = 800; // 8% in basis points
            uint256 riskPremium = (risk * 1200) / 100; // Up to 12% additional based on risk
            invoice.aprBasisPoints = baseAPR + riskPremium;

            // Cap at 20%
            if (invoice.aprBasisPoints > 2000) {
                invoice.aprBasisPoints = 2000;
            }

            invoice.status = InvoiceStatus.Verified;
            emit InvoiceVerified(invoiceId, invoice.aprBasisPoints, risk, rating);
        } else {
            invoice.status = InvoiceStatus.Rejected;
            emit InvoiceRejected(invoiceId, "Failed risk assessment");
        }
    }

    // ============ HELPER FUNCTIONS ============
    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        for (uint i = 0; i < strBytes.length; i++) {
            if (strBytes[i] >= 0x41 && strBytes[i] <= 0x5A) {
                strBytes[i] = bytes1(uint8(strBytes[i]) + 32);
            }
        }
        return string(strBytes);
    }

    // ============ VIEW FUNCTIONS ============
    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        require(invoiceId > 0 && invoiceId <= invoiceCounter, "Invalid invoice ID");
        return invoices[invoiceId];
    }

    function getSupplierInvoices(address supplier) external view returns (uint256[] memory) {
        return supplierInvoices[supplier];
    }

    function getBuyerInvoices(address buyer) external view returns (uint256[] memory) {
        return buyerInvoices[buyer];
    }

    function getProtocolStats() external view returns (
        uint256 totalInvoices,
        uint256 verifiedCount,
        uint256 rejectedCount
    ) {
        totalInvoices = invoiceCounter;

        for (uint256 i = 1; i <= invoiceCounter; i++) {
            if (invoices[i].status == InvoiceStatus.Verified ||
                invoices[i].status == InvoiceStatus.FullyFunded ||
                invoices[i].status == InvoiceStatus.Funded ||
                invoices[i].status == InvoiceStatus.Repaid) {
                verifiedCount++;
            } else if (invoices[i].status == InvoiceStatus.Rejected) {
                rejectedCount++;
            }
        }
    }

    // ============ INVESTMENT FUNCTIONS ============
    function investInInvoice(uint256 invoiceId, uint256 amount) external notPaused returns (bool) {
        require(invoiceId > 0 && invoiceId <= invoiceCounter, "Invalid invoice ID");
        require(amount > 0, "Amount must be positive");
        require(address(usdcToken) != address(0), "USDC token not configured");

        Invoice storage invoice = invoices[invoiceId];
        require(invoice.status == InvoiceStatus.Verified, "Invoice not available for investment");
        require(invoice.currentFunding + amount <= invoice.targetFunding, "Investment exceeds target");

        // Check allowance
        uint256 allowance = usdcToken.allowance(msg.sender, address(this));
        require(allowance >= amount, "Insufficient USDC allowance");

        // Check balance
        uint256 balance = usdcToken.balanceOf(msg.sender);
        require(balance >= amount, "Insufficient USDC balance");

        // Transfer USDC from investor to this contract
        bool transferred = usdcToken.transferFrom(msg.sender, address(this), amount);
        require(transferred, "USDC transfer failed");

        // Record the investment
        invoiceInvestments[invoiceId].push(Investment({
            investor: msg.sender,
            amount: amount,
            timestamp: block.timestamp
        }));

        // Track investor's invoices
        investorInvoices[msg.sender].push(invoiceId);

        // Update funding
        invoice.currentFunding += amount;

        emit InvestmentMade(invoiceId, msg.sender, amount, invoice.currentFunding);

        // Check if fully funded
        if (invoice.currentFunding >= invoice.targetFunding) {
            invoice.status = InvoiceStatus.FullyFunded;
            emit InvoiceFullyFunded(invoiceId, invoice.currentFunding);
        }

        return true;
    }

    // Get contract's USDC balance
    function getContractUSDCBalance() external view returns (uint256) {
        if (address(usdcToken) == address(0)) return 0;
        return usdcToken.balanceOf(address(this));
    }

    function getInvoiceInvestments(uint256 invoiceId) external view returns (Investment[] memory) {
        return invoiceInvestments[invoiceId];
    }

    function getInvestorInvoices(address investor) external view returns (uint256[] memory) {
        return investorInvoices[investor];
    }

    // ============ ADMIN FUNCTIONS ============
    function pause() external onlyOwner {
        paused = true;
        emit ProtocolPaused(true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit ProtocolPaused(false);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}
