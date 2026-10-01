//! EarnX risk engine: an Arbitrum Stylus contract written in Rust.
//!
//! `EarnXProtocol` calls `quote` when a verifier approves an invoice, and uses the result instead of
//! any APR or advance rate the verifier proposes. Pricing is a fixed, published formula with no
//! storage and no owner, so every invoice's terms can be recomputed by anyone from its risk score,
//! term and size.
//!
//! Solidity interface (matches `IRiskEngine`):
//! ```solidity
//! function quote(uint8 riskScore, uint32 tenorDays, uint256 faceValue)
//!     external view returns (uint16 aprBps, uint16 advanceBps);
//! ```
//!
//! Amounts are in 6-decimal dollar stablecoins (USDG, USDC).
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use stylus_sdk::{alloy_primitives::U256, prelude::*};

/// 8% base yield for investors on the safest invoices.
pub const BASE_APR_BPS: u32 = 800;
/// Each risk point (0-100) adds 0.15% APR.
pub const RISK_BPS_PER_POINT: u32 = 15;
/// Beyond 30 days, every 3 extra days adds 0.01% APR.
pub const TERM_FREE_DAYS: u32 = 30;
pub const TERM_DAYS_PER_BPS: u32 = 3;
pub const MIN_APR_BPS: u32 = 500;
pub const MAX_APR_BPS: u32 = 5_000;

/// Exporters get 90% of the invoice up front when risk is 30 or lower.
pub const MAX_ADVANCE_BPS: u32 = 9_000;
pub const MIN_ADVANCE_BPS: u32 = 7_000;
/// Above a risk score of 30, each point lowers the advance by 0.25%.
pub const RISK_FREE_POINTS: u32 = 30;
pub const ADVANCE_BPS_PER_POINT: u32 = 25;
/// Invoices longer than 120 days get 5% less up front.
pub const LONG_TENOR_DAYS: u32 = 120;
pub const LONG_TENOR_HAIRCUT_BPS: u32 = 500;

/// Larger invoices concentrate risk, so they pay a little more.
const MEDIUM_INVOICE: u64 = 50_000 * 1_000_000;
const LARGE_INVOICE: u64 = 100_000 * 1_000_000;

sol_storage! {
    #[entrypoint]
    pub struct RiskEngine {}
}

#[public]
impl RiskEngine {
    /// Returns the investor APR and the share of the invoice advanced to the exporter, in basis points.
    pub fn quote(&self, risk_score: u8, tenor_days: u32, face_value: U256) -> (u16, u16) {
        price(risk_score, tenor_days, face_value)
    }

    /// Version of the pricing formula, so integrators can tell engines apart.
    pub fn version(&self) -> u16 {
        1
    }
}

/// The pricing formula, kept free of contract state so it can be unit-tested and audited directly.
pub fn price(risk_score: u8, tenor_days: u32, face_value: U256) -> (u16, u16) {
    let risk = u32::from(risk_score.min(100));

    let term_premium = tenor_days.saturating_sub(TERM_FREE_DAYS) / TERM_DAYS_PER_BPS;
    let size_premium = if face_value > U256::from(LARGE_INVOICE) {
        50
    } else if face_value > U256::from(MEDIUM_INVOICE) {
        25
    } else {
        0
    };
    let apr = BASE_APR_BPS
        .saturating_add(risk * RISK_BPS_PER_POINT)
        .saturating_add(term_premium)
        .saturating_add(size_premium)
        .clamp(MIN_APR_BPS, MAX_APR_BPS);

    let risk_haircut = risk.saturating_sub(RISK_FREE_POINTS) * ADVANCE_BPS_PER_POINT;
    let tenor_haircut = if tenor_days > LONG_TENOR_DAYS { LONG_TENOR_HAIRCUT_BPS } else { 0 };
    let advance = MAX_ADVANCE_BPS
        .saturating_sub(risk_haircut + tenor_haircut)
        .clamp(MIN_ADVANCE_BPS, MAX_ADVANCE_BPS);

    (apr as u16, advance as u16)
}

#[cfg(test)]
mod tests {
    use super::*;

    const USD: u64 = 1_000_000;

    #[test]
    fn safest_short_invoice_gets_base_terms() {
        assert_eq!(price(0, 30, U256::from(10_000 * USD)), (800, 9_000));
    }

    #[test]
    fn typical_cocoa_invoice() {
        // risk 28, 75 days, 48,000 USDG: 8% + 4.2% risk + 0.15% term = 12.35%, 90% advance
        assert_eq!(price(28, 75, U256::from(48_000 * USD)), (1_235, 9_000));
    }

    #[test]
    fn riskier_and_longer_invoices_cost_more_and_advance_less() {
        let (apr_low, adv_low) = price(20, 60, U256::from(20_000 * USD));
        let (apr_high, adv_high) = price(60, 150, U256::from(120_000 * USD));
        assert!(apr_high > apr_low);
        assert!(adv_high < adv_low);
        // 8% + 9% risk + 0.4% term + 0.5% size = 17.9%; 90% - 7.5% - 5% = 77.5%
        assert_eq!((apr_high, adv_high), (1_790, 7_750));
    }

    #[test]
    fn outputs_stay_inside_the_protocol_limits() {
        for risk in [0u8, 30, 80, 100, 255] {
            for tenor in [0u32, 7, 30, 120, 365, u32::MAX] {
                let (apr, adv) = price(risk, tenor, U256::MAX);
                assert!((500..=5_000).contains(&apr), "apr {apr} for risk {risk} tenor {tenor}");
                assert!((7_000..=9_000).contains(&adv), "advance {adv} for risk {risk} tenor {tenor}");
            }
        }
    }

    #[test]
    fn apr_never_decreases_with_risk() {
        let mut last = 0;
        for risk in 0..=100u8 {
            let (apr, _) = price(risk, 90, U256::from(30_000 * USD));
            assert!(apr >= last);
            last = apr;
        }
    }

    #[test]
    fn contract_entrypoint_matches_formula() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let engine = RiskEngine::from(&vm);
        assert_eq!(engine.quote(35, 60, U256::from(32_500 * USD)), price(35, 60, U256::from(32_500 * USD)));
        assert_eq!(engine.version(), 1);
    }
}
