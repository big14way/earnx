// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IEarnX} from "./interfaces/IEarnX.sol";

/// @notice One token per verified invoice, minted to the exporter. Tokens are non-transferable
/// (ERC-5192): together they form the exporter's on-chain trade history, the record a bank would
/// normally ask for and most small African exporters cannot show. Metadata is rendered on-chain
/// from the live invoice, so a token's status moves from Funding to Funded to Repaid.
contract EarnXInvoiceNFT is ERC721 {
    using Strings for uint256;

    /// @dev ERC-5192 minimal soulbound interface.
    event Locked(uint256 tokenId);

    IEarnX public immutable protocol;

    error OnlyProtocol();
    error Soulbound();

    constructor(IEarnX protocol_) ERC721("EarnX Invoice", "EXINV") {
        protocol = protocol_;
    }

    function mint(address to, uint256 tokenId) external {
        if (msg.sender != address(protocol)) revert OnlyProtocol();
        _mint(to, tokenId);
        emit Locked(tokenId);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0)) revert Soulbound();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        IEarnX.Invoice memory inv = protocol.getInvoice(tokenId);
        IERC20Metadata token = IERC20Metadata(inv.token);
        string memory amount = string.concat(_thousands(inv.faceValue / 10 ** token.decimals()), " ", token.symbol());
        string memory route = string.concat(inv.origin, " to ", inv.destination);
        string memory status = _statusName(inv.status);

        string memory json = string.concat(
            '{"name":"EarnX Invoice #',
            tokenId.toString(),
            '","description":"',
            Strings.escapeJSON(string.concat("Verified trade invoice: ", inv.commodity, ", ", route, ", ", amount)),
            '. Non-transferable: part of the exporter\'s on-chain trade history.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(_svg(tokenId, inv, amount, route, status))),
            '","attributes":',
            _attributes(inv, amount, status),
            "}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _attributes(IEarnX.Invoice memory inv, string memory amount, string memory status)
        private
        pure
        returns (string memory)
    {
        return string.concat(
            '[{"trait_type":"Status","value":"',
            status,
            '"},{"trait_type":"Commodity","value":"',
            Strings.escapeJSON(inv.commodity),
            '"},{"trait_type":"Origin","value":"',
            Strings.escapeJSON(inv.origin),
            '"},{"trait_type":"Destination","value":"',
            Strings.escapeJSON(inv.destination),
            '"},{"trait_type":"Face value","value":"',
            amount,
            '"},{"trait_type":"APR","value":"',
            _percent(inv.aprBps),
            '"},{"trait_type":"Risk score","display_type":"number","value":',
            uint256(inv.riskScore).toString(),
            '},{"trait_type":"Due","display_type":"date","value":',
            uint256(inv.dueDate).toString(),
            "}]"
        );
    }

    function _svg(
        uint256 tokenId,
        IEarnX.Invoice memory inv,
        string memory amount,
        string memory route,
        string memory status
    ) private pure returns (string memory) {
        return string.concat(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' font-family='Helvetica,Arial,sans-serif'>",
            "<rect width='400' height='250' rx='18' fill='#10231a'/>",
            "<text x='24' y='40' fill='#c8f169' font-size='13' letter-spacing='2'>EARNX INVOICE #",
            tokenId.toString(),
            "</text><text x='24' y='92' fill='#ffffff' font-size='30' font-weight='700'>",
            _xml(amount),
            "</text><text x='24' y='126' fill='#cfd8d2' font-size='15'>",
            _xml(string.concat(inv.commodity, " / ", route)),
            "</text><text x='24' y='152' fill='#cfd8d2' font-size='15'>APR ",
            _percent(inv.aprBps),
            " / Risk ",
            uint256(inv.riskScore).toString(),
            "/100</text><text x='24' y='218' fill='",
            _statusColor(inv.status),
            "' font-size='16' font-weight='700' letter-spacing='1'>",
            status,
            "</text></svg>"
        );
    }

    function _statusName(IEarnX.Status s) private pure returns (string memory) {
        if (s == IEarnX.Status.Submitted) return "SUBMITTED";
        if (s == IEarnX.Status.Funding) return "FUNDING";
        if (s == IEarnX.Status.Funded) return "FUNDED";
        if (s == IEarnX.Status.Repaid) return "REPAID";
        if (s == IEarnX.Status.Defaulted) return "DEFAULTED";
        if (s == IEarnX.Status.Rejected) return "REJECTED";
        return "CANCELLED";
    }

    function _statusColor(IEarnX.Status s) private pure returns (string memory) {
        if (s == IEarnX.Status.Repaid) return "#c8f169";
        if (s == IEarnX.Status.Defaulted) return "#ff8a7a";
        return "#ffd27a";
    }

    /// @dev 1400 -> "14.00%"
    function _percent(uint16 bps) private pure returns (string memory) {
        uint256 cents = bps % 100;
        return string.concat(
            uint256(bps / 100).toString(), ".", cents < 10 ? "0" : "", cents.toString(), "%"
        );
    }

    /// @dev 1234567 -> "1,234,567"
    function _thousands(uint256 value) private pure returns (string memory) {
        if (value < 1000) return value.toString();
        uint256 group = value % 1000;
        string memory padded = group < 10 ? "00" : group < 100 ? "0" : "";
        return string.concat(_thousands(value / 1000), ",", padded, group.toString());
    }

    /// @dev Escapes the five XML special characters so user-supplied text can't break the SVG.
    function _xml(string memory input) private pure returns (string memory) {
        bytes memory b = bytes(input);
        bytes memory out = new bytes(b.length * 6);
        uint256 n;
        for (uint256 i; i < b.length; ++i) {
            bytes memory rep;
            if (b[i] == "<") rep = "&lt;";
            else if (b[i] == ">") rep = "&gt;";
            else if (b[i] == "&") rep = "&amp;";
            else if (b[i] == "'") rep = "&apos;";
            else if (b[i] == '"') rep = "&quot;";
            if (rep.length == 0) {
                out[n++] = b[i];
            } else {
                for (uint256 j; j < rep.length; ++j) out[n++] = rep[j];
            }
        }
        assembly ("memory-safe") {
            mstore(out, n)
        }
        return string(out);
    }
}
