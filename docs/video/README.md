# Pitch and demo video

The buildathon video is recorded from the live app at https://earnx-app.vercel.app with real transactions on
Robinhood Chain testnet, then cut into a narrated MP4. `NARRATION.md` lists every scene, its timing and its
voice-over. The MP4 and the raw recordings are not in git.

## What is recorded

| Scene | Who | What happens on-chain |
|---|---|---|
| `landing` | investor wallet connected | nothing (reads) |
| `exporter` | new passkey account (virtual authenticator) | invoice submitted with its number and docs hash, pre-screened (duplicate check, $1,000 limit for unverified exporters), priced by the Stylus engine, soulbound token minted; then her deal sheet, still signed in |
| `buyerconfirm` | `DEMO_EXPORTER_PRIVATE_KEY`, acting as the buyer | signs the statement; it is pinned to IPFS |
| `invest` | `DEPLOYER_PRIVATE_KEY` | sees "Buyer confirmed", funds the whole invoice; the same transaction pays the exporter and the reserve |
| `repay` | the buyer | repays in full |
| `claim` | `DEPLOYER_PRIVATE_KEY` | investor claims principal plus yield |
| `explorer` | — | the funding and repayment transactions on Robinhood Chain's Blockscout |
| `record`, `activity`, `market` | investor wallet | nothing (reads) |
| `tests` | — | replays the real `forge test` and `cargo test --lib` output |

The final cut uses invoice #19 on Robinhood Chain testnet. Every step in the video is a transaction you can open:

| Step | Transaction |
|---|---|
| Submitted by the passkey account | [0x4b57…6217](https://explorer.testnet.chain.robinhood.com/tx/0x4b577606b6463a0d1bf9e2dcac9dc4a56e97a7d8bb90abae3776b32063b76217) |
| Verified, priced by the Stylus engine, record token minted | [0x95b8…25f2](https://explorer.testnet.chain.robinhood.com/tx/0x95b85e78f9836963c8e5ce1412f23d616a59abb6c8095bd7ff662b5d65c825f2) |
| Buyer confirmation | signed statement on IPFS, [`bafkreifvv3u4…npjm`](https://gateway.pinata.cloud/ipfs/bafkreifvv3u4pg37vxskjy5cbyfq2gaz6p2prhpg3oxnnjjralyrkhpnjm) |
| Funded; exporter and reserve paid in the same transaction | [0xf033…be3e](https://explorer.testnet.chain.robinhood.com/tx/0xf0330a8a0398ac2c4bc9c0f381d916d7922513921cd01b02fbd597692967be3e) |
| Repaid in full by the buyer | [0x4995…11a5](https://explorer.testnet.chain.robinhood.com/tx/0x4995f7ef55885c70fef66b18b4760cca4f7bca2b81cccb4dd2d212e28b0311a5) |
| Investor claimed principal plus yield | [0x8118…19a1](https://explorer.testnet.chain.robinhood.com/tx/0x8118c43893d9b530d2d7b1bf9cd9779f46e30c4985403af968073177dc7a19a1) |
| The exporter's trade record in the app | [earnx-app.vercel.app/exporter/46630/0xa233…b303](https://earnx-app.vercel.app/exporter/46630/0xa233f5Ff1647eb2b48ED40d5dBA97FF37112b303) |

## Rebuild

Needs Node with Playwright and viem, ffmpeg, Python with Pillow, reportlab and edge-tts, and the pitch-video toolkit that
`record.js` loads its page helpers from.

```sh
cp ../../app/public/story/mama-dora.jpg img/
python3 docs/make_docs.py docs/video-book.json docs   # the sample invoice and bill of lading (reportlab)
set -a; source ../../.env; set +a              # wallet keys, by the names in scenes.json
node record.js scenes.json                     # or a comma-separated list of scene names
caffeinate -i python3 <toolkit>/build_demo.py demo.json
python3 make_table.py                          # regenerates NARRATION.md
```

The buyer wallet needs about 41 USDG to repay, the investor about 41 USDG to fund, and the exporter needs nothing:
its fees are sponsored by the ZeroDev paymaster.
