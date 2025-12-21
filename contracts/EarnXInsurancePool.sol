// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MantleUSDC.sol";

/**
 * @title EarnXInsurancePool
 * @notice Default protection and insurance pool for EarnX trade finance protocol
 * @dev Provides coverage for investor losses due to invoice defaults
 *
 * Key Features:
 * - Insurance pool funded by protocol fees and direct contributions
 * - Tiered coverage based on risk scores
 * - Automatic claim processing for verified defaults
 * - Staking mechanism for additional yield
 */
contract EarnXInsurancePool {

    // ============ STATE VARIABLES ============
    MantleUSDC public immutable usdcToken;
    address public owner;
    address public protocolAddress;

    // Pool financials
    uint256 public totalPoolBalance;
    uint256 public totalClaimed;
    uint256 public totalContributions;

    // Coverage parameters (in basis points)
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant PROTOCOL_FEE_TO_POOL = 200; // 2% of protocol fees go to insurance
    uint256 public constant MAX_COVERAGE_RATIO = 8000; // Maximum 80% coverage
    uint256 public constant MIN_COVERAGE_RATIO = 5000; // Minimum 50% coverage

    // Risk-based coverage tiers
    mapping(string => uint256) public riskTierCoverage;

    // Staking
    uint256 public totalStaked;
    uint256 public stakingAPY = 500; // 5% APY for stakers
    mapping(address => StakeInfo) public stakes;

    // Claims
    uint256 public claimCounter;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => bool) public invoiceClaimed;

    // ============ STRUCTS ============
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastClaimTime;
        uint256 pendingRewards;
    }

    struct Claim {
        uint256 id;
        uint256 invoiceId;
        address investor;
        uint256 investmentAmount;
        uint256 claimAmount;
        uint256 coverageRatio;
        ClaimStatus status;
        uint256 createdAt;
        uint256 processedAt;
        string reason;
    }

    enum ClaimStatus {
        Pending,
        Approved,
        Rejected,
        Paid
    }

    // ============ EVENTS ============
    event PoolFunded(address indexed contributor, uint256 amount, string source);
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed invoiceId, address indexed investor, uint256 amount);
    event ClaimProcessed(uint256 indexed claimId, ClaimStatus status, uint256 paidAmount);
    event Staked(address indexed staker, uint256 amount);
    event Unstaked(address indexed staker, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed staker, uint256 rewards);
    event CoverageTierUpdated(string tier, uint256 coverage);

    // ============ MODIFIERS ============
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyProtocol() {
        require(msg.sender == protocolAddress, "Only protocol");
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = MantleUSDC(_usdcToken);
        owner = msg.sender;

        // Initialize risk tier coverage (higher risk = lower coverage)
        riskTierCoverage["AAA"] = 8000; // 80% coverage for lowest risk
        riskTierCoverage["AA"] = 7500;  // 75% coverage
        riskTierCoverage["A"] = 7000;   // 70% coverage
        riskTierCoverage["BBB"] = 6500; // 65% coverage
        riskTierCoverage["BB"] = 6000;  // 60% coverage
        riskTierCoverage["B"] = 5000;   // 50% coverage for highest risk
    }

    // ============ POOL FUNDING ============

    /**
     * @notice Fund the insurance pool directly
     * @param amount Amount to contribute
     */
    function fundPool(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        totalPoolBalance += amount;
        totalContributions += amount;

        emit PoolFunded(msg.sender, amount, "direct");
    }

    /**
     * @notice Receive protocol fees into the pool
     * @param amount Amount from protocol fees
     */
    function receiveProtocolFees(uint256 amount) external onlyProtocol {
        require(amount > 0, "Amount must be positive");

        totalPoolBalance += amount;
        totalContributions += amount;

        emit PoolFunded(msg.sender, amount, "protocol_fees");
    }

    // ============ STAKING ============

    /**
     * @notice Stake USDC into the insurance pool for yield
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Calculate pending rewards before updating
        if (stakes[msg.sender].amount > 0) {
            stakes[msg.sender].pendingRewards += _calculateRewards(msg.sender);
        }

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].stakedAt = block.timestamp;
        stakes[msg.sender].lastClaimTime = block.timestamp;

        totalStaked += amount;
        totalPoolBalance += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake USDC and claim rewards
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        require(stakeInfo.amount >= amount, "Insufficient staked amount");

        uint256 rewards = _calculateRewards(msg.sender) + stakeInfo.pendingRewards;

        stakeInfo.amount -= amount;
        stakeInfo.pendingRewards = 0;
        stakeInfo.lastClaimTime = block.timestamp;

        totalStaked -= amount;
        totalPoolBalance -= amount;

        uint256 totalPayout = amount + rewards;
        require(usdcToken.transfer(msg.sender, totalPayout), "Transfer failed");

        emit Unstaked(msg.sender, amount, rewards);
    }

    /**
     * @notice Claim staking rewards without unstaking
     */
    function claimRewards() external {
        uint256 rewards = _calculateRewards(msg.sender) + stakes[msg.sender].pendingRewards;
        require(rewards > 0, "No rewards to claim");

        stakes[msg.sender].pendingRewards = 0;
        stakes[msg.sender].lastClaimTime = block.timestamp;

        require(usdcToken.transfer(msg.sender, rewards), "Transfer failed");

        emit RewardsClaimed(msg.sender, rewards);
    }

    /**
     * @notice Calculate pending rewards for a staker
     */
    function _calculateRewards(address staker) internal view returns (uint256) {
        StakeInfo memory stakeInfo = stakes[staker];
        if (stakeInfo.amount == 0) return 0;

        uint256 timeStaked = block.timestamp - stakeInfo.lastClaimTime;
        uint256 annualReward = (stakeInfo.amount * stakingAPY) / BASIS_POINTS;

        return (annualReward * timeStaked) / 365 days;
    }

    /**
     * @notice Get pending rewards for a staker
     */
    function getPendingRewards(address staker) external view returns (uint256) {
        return _calculateRewards(staker) + stakes[staker].pendingRewards;
    }

    // ============ CLAIMS ============

    /**
     * @notice Submit a claim for a defaulted invoice
     * @param invoiceId The defaulted invoice ID
     * @param investor The investor address
     * @param investmentAmount Original investment amount
     * @param creditRating Credit rating of the invoice
     * @param reason Reason for default
     */
    function submitClaim(
        uint256 invoiceId,
        address investor,
        uint256 investmentAmount,
        string memory creditRating,
        string memory reason
    ) external onlyProtocol returns (uint256) {
        require(!invoiceClaimed[invoiceId], "Invoice already claimed");
        require(investmentAmount > 0, "Invalid investment amount");

        uint256 coverageRatio = riskTierCoverage[creditRating];
        if (coverageRatio == 0) {
            coverageRatio = MIN_COVERAGE_RATIO; // Default to minimum coverage
        }

        uint256 claimAmount = (investmentAmount * coverageRatio) / BASIS_POINTS;

        claimCounter++;
        uint256 claimId = claimCounter;

        claims[claimId] = Claim({
            id: claimId,
            invoiceId: invoiceId,
            investor: investor,
            investmentAmount: investmentAmount,
            claimAmount: claimAmount,
            coverageRatio: coverageRatio,
            status: ClaimStatus.Pending,
            createdAt: block.timestamp,
            processedAt: 0,
            reason: reason
        });

        invoiceClaimed[invoiceId] = true;

        emit ClaimSubmitted(claimId, invoiceId, investor, claimAmount);

        return claimId;
    }

    /**
     * @notice Process a pending claim (auto-approve if pool has funds)
     * @param claimId The claim to process
     */
    function processClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.Pending, "Claim not pending");

        claim.processedAt = block.timestamp;

        // Check if pool has sufficient funds
        uint256 availableFunds = totalPoolBalance - totalStaked; // Protect staker funds first

        if (claim.claimAmount <= availableFunds) {
            claim.status = ClaimStatus.Approved;

            // Transfer claim amount to investor
            require(usdcToken.transfer(claim.investor, claim.claimAmount), "Transfer failed");

            totalPoolBalance -= claim.claimAmount;
            totalClaimed += claim.claimAmount;

            claim.status = ClaimStatus.Paid;

            emit ClaimProcessed(claimId, ClaimStatus.Paid, claim.claimAmount);
        } else {
            // Partial payment or rejection based on available funds
            if (availableFunds > 0) {
                // Partial payment
                uint256 partialPayment = availableFunds;
                require(usdcToken.transfer(claim.investor, partialPayment), "Transfer failed");

                totalPoolBalance -= partialPayment;
                totalClaimed += partialPayment;

                claim.claimAmount = partialPayment;
                claim.status = ClaimStatus.Paid;

                emit ClaimProcessed(claimId, ClaimStatus.Paid, partialPayment);
            } else {
                claim.status = ClaimStatus.Rejected;
                emit ClaimProcessed(claimId, ClaimStatus.Rejected, 0);
            }
        }
    }

    /**
     * @notice Batch process multiple claims for an invoice default
     * @param invoiceId The defaulted invoice
     * @param investors Array of investor addresses
     * @param amounts Array of investment amounts
     * @param creditRating Credit rating of the invoice
     */
    function processDefaultForInvoice(
        uint256 invoiceId,
        address[] calldata investors,
        uint256[] calldata amounts,
        string memory creditRating
    ) external onlyProtocol {
        require(investors.length == amounts.length, "Array length mismatch");
        require(!invoiceClaimed[invoiceId], "Invoice already processed");

        uint256 coverageRatio = riskTierCoverage[creditRating];
        if (coverageRatio == 0) coverageRatio = MIN_COVERAGE_RATIO;

        uint256 availableFunds = totalPoolBalance - totalStaked;
        uint256 totalNeeded = 0;

        // Calculate total needed
        for (uint256 i = 0; i < amounts.length; i++) {
            totalNeeded += (amounts[i] * coverageRatio) / BASIS_POINTS;
        }

        // Adjust coverage ratio if insufficient funds
        if (totalNeeded > availableFunds && availableFunds > 0) {
            coverageRatio = (availableFunds * BASIS_POINTS) / _sum(amounts);
        }

        // Process each investor
        for (uint256 i = 0; i < investors.length; i++) {
            uint256 claimAmount = (amounts[i] * coverageRatio) / BASIS_POINTS;

            if (claimAmount > 0 && totalPoolBalance >= claimAmount) {
                require(usdcToken.transfer(investors[i], claimAmount), "Transfer failed");
                totalPoolBalance -= claimAmount;
                totalClaimed += claimAmount;
            }
        }

        invoiceClaimed[invoiceId] = true;
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get pool statistics
     */
    function getPoolStats() external view returns (
        uint256 balance,
        uint256 staked,
        uint256 available,
        uint256 claimed,
        uint256 contributions,
        uint256 pendingClaims
    ) {
        uint256 pending = 0;
        for (uint256 i = 1; i <= claimCounter; i++) {
            if (claims[i].status == ClaimStatus.Pending) {
                pending++;
            }
        }

        return (
            totalPoolBalance,
            totalStaked,
            totalPoolBalance - totalStaked,
            totalClaimed,
            totalContributions,
            pending
        );
    }

    /**
     * @notice Calculate coverage amount for a potential default
     * @param investmentAmount Investment amount
     * @param creditRating Credit rating
     */
    function calculateCoverage(
        uint256 investmentAmount,
        string memory creditRating
    ) external view returns (uint256 coverageAmount, uint256 coverageRatio) {
        coverageRatio = riskTierCoverage[creditRating];
        if (coverageRatio == 0) coverageRatio = MIN_COVERAGE_RATIO;
        coverageAmount = (investmentAmount * coverageRatio) / BASIS_POINTS;
    }

    /**
     * @notice Check if pool can cover a default
     * @param amount Amount to check
     */
    function canCoverDefault(uint256 amount) external view returns (bool) {
        return (totalPoolBalance - totalStaked) >= amount;
    }

    /**
     * @notice Get stake info for an address
     */
    function getStakeInfo(address staker) external view returns (
        uint256 stakedAmount,
        uint256 stakedAt,
        uint256 pendingRewards,
        uint256 totalValue
    ) {
        StakeInfo memory info = stakes[staker];
        uint256 rewards = _calculateRewards(staker) + info.pendingRewards;

        return (
            info.amount,
            info.stakedAt,
            rewards,
            info.amount + rewards
        );
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set the protocol address
     */
    function setProtocolAddress(address _protocol) external onlyOwner {
        require(_protocol != address(0), "Invalid address");
        protocolAddress = _protocol;
    }

    /**
     * @notice Update coverage tier
     */
    function updateCoverageTier(string memory tier, uint256 coverage) external onlyOwner {
        require(coverage >= MIN_COVERAGE_RATIO && coverage <= MAX_COVERAGE_RATIO, "Invalid coverage");
        riskTierCoverage[tier] = coverage;
        emit CoverageTierUpdated(tier, coverage);
    }

    /**
     * @notice Update staking APY
     */
    function updateStakingAPY(uint256 newAPY) external onlyOwner {
        require(newAPY <= 2000, "APY too high"); // Max 20%
        stakingAPY = newAPY;
    }

    /**
     * @notice Emergency withdraw (only if no pending claims)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        uint256 available = totalPoolBalance - totalStaked;
        require(amount <= available, "Insufficient available funds");

        // Check no pending claims
        for (uint256 i = 1; i <= claimCounter; i++) {
            require(claims[i].status != ClaimStatus.Pending, "Pending claims exist");
        }

        require(usdcToken.transfer(owner, amount), "Transfer failed");
        totalPoolBalance -= amount;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // ============ HELPER FUNCTIONS ============

    function _sum(uint256[] calldata arr) internal pure returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            total += arr[i];
        }
        return total;
    }

    // ============ VERSION ============
    function version() external pure returns (string memory) {
        return "EarnXInsurancePool v1.0.0";
    }
}
