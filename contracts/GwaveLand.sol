// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// Gwave Land — metaverse ရဲ့ မြေကွက် (32×32 = ကွက် ၁၀၂၄)။
///
/// ★ tokenId က နေရာနဲ့ **တစ်ခုတည်း တွဲထားတယ်** (gx * 32 + gz)。 ဒါကြောင့်
///   ကွက်တစ်ကွက်ကို NFT ၂ ခု ဘယ်တော့မှ မထုတ်နိုင်ဘူး — mapping သီးသန့်
///   ထားပြီး ကိုယ်တိုင် စစ်စရာမလိုဘူး၊ ERC721 ကိုယ်တိုင်က တားပေးတယ်။
/// ★ ဆောက်လုပ်မှု data ကို on-chain **မထားဘူး** — gas ကုန်လွန်းတယ်။
///   `mv_plots.build_data` (JSONB) မှာ off-chain သိမ်းတယ်။
contract GwaveLand is ERC721, Ownable {
    uint256 public constant GRID = 32;

    mapping(uint256 => string) public plotName;

    event PlotNamed(uint256 indexed tokenId, string name);

    constructor() ERC721("Gwave Land", "GLAND") Ownable(msg.sender) {}

    function tokenIdFor(uint256 gx, uint256 gz) public pure returns (uint256) {
        require(gx < GRID && gz < GRID, "out of bounds");
        return gx * GRID + gz;
    }

    function mintPlot(address to, uint256 gx, uint256 gz) external onlyOwner {
        _safeMint(to, tokenIdFor(gx, gz));
    }

    /// ★ ပိုင်ရှင်ကသာ နာမည်ပေးလို့ရမယ်။ ဒါမရှိရင် ဘယ်သူမဆို တခြားသူ့
    /// မြေကွက်ပေါ်မှာ ဘာမဆို ရေးထားလို့ရမယ်။
    function setPlotName(uint256 tokenId, string calldata name) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(bytes(name).length <= 32, "name too long");
        plotName[tokenId] = name;
        emit PlotNamed(tokenId, name);
    }
}
