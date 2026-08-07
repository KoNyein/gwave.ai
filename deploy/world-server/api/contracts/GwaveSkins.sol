// SPDX-License-Identifier: MIT
// ============================================================
// GwaveSkins.sol — Gwave Skin NFT (ERC-721, Phase 1 testnet)
// Game ၏ signer wallet (owner) ကသာ mint နိုင် — custodial mint
// tokenURI = baseURI + itemId (metadata ကို gwave.cc မှ serve)
// Deploy: node deploy-contract.js  (contracts/README ကိုကြည့်)
// ============================================================
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GwaveSkins is ERC721, Ownable {
    uint256 public nextTokenId = 1;
    string public baseURI;
    mapping(uint256 => string) public itemIdOf; // tokenId → skin item id

    event SkinMinted(address indexed to, uint256 indexed tokenId, string itemId);

    constructor(string memory _baseURI)
        ERC721("Gwave Skins", "GWSKIN")
        Ownable(msg.sender)
    { baseURI = _baseURI; }

    function mintSkin(address to, string calldata itemId)
        external onlyOwner returns (uint256)
    {
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        itemIdOf[tokenId] = itemId;
        emit SkinMinted(to, tokenId, itemId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(baseURI, itemIdOf[tokenId], ".json"));
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }
}
