// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// Gwave Items — အဝတ်အစား, ဦးထုပ်, emote unlock (ERC-1155)။
///
/// id 1–999    : cosmetic (ဦးထုပ်၊ အဝတ်၊ အရောင်)
/// id 1000+    : emote unlock
///
/// ★ ERC-1155 ကို သုံးရတာက တစ်မျိုးတည်းကို လူများစွာ ပိုင်လို့ရဖို့ —
///   ERC-721 ဆိုရင် ဦးထုပ်တစ်လုံးကို တစ်ယောက်တည်းပဲ ပိုင်လို့ရမယ်။
contract GwaveItems is ERC1155, Ownable {
    string public name = "Gwave Items";
    string public symbol = "GITEM";

    constructor()
        ERC1155("https://cdn.gwave.cc/metaverse/items/{id}.json")
        Ownable(msg.sender)
    {}

    function mint(address to, uint256 id, uint256 amount) external onlyOwner {
        _mint(to, id, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        _mintBatch(to, ids, amounts, "");
    }

    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }
}
