// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IdentityVerification
 * @dev Decentralized identity verification smart contract
 * @notice Stores cryptographic proofs of identity on-chain
 */
contract IdentityVerification {

    // ─── Structs ─────────────────────────────────────────────
    struct Identity {
        string identityHash;    // SHA-256 hash of user data (privacy preserved)
        uint256 timestamp;      // Block timestamp of verification
        bool verified;          // Verification status (renamed to avoid clash with isVerified function)
        address verifiedBy;     // Address that submitted (usually the user themselves)
    }

    // ─── State Variables ──────────────────────────────────────
    address public owner;

    // wallet address => Identity record
    mapping(address => Identity) private identities;

    // All verified addresses (for enumeration)
    address[] private verifiedUsers;

    // Total count
    uint256 public totalVerified;

    // ─── Events ───────────────────────────────────────────────
    event IdentityVerified(
        address indexed user,
        string identityHash,
        uint256 timestamp
    );

    event IdentityRevoked(
        address indexed user,
        uint256 timestamp
    );

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier notAlreadyVerified() {
        require(!identities[msg.sender].verified, "Already verified");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Functions ────────────────────────────────────────────

    /**
     * @dev Submit identity hash for verification
     * @param _identityHash SHA-256 hash of identity data (computed client-side)
     */
    function verifyIdentity(string memory _identityHash) external notAlreadyVerified {
        require(bytes(_identityHash).length > 0, "Hash cannot be empty");

        identities[msg.sender] = Identity({
            identityHash: _identityHash,
            timestamp: block.timestamp,
            verified: true,
            verifiedBy: msg.sender
        });

        verifiedUsers.push(msg.sender);
        totalVerified++;

        emit IdentityVerified(msg.sender, _identityHash, block.timestamp);
    }

    /**
     * @dev Get identity record for a given address
     * @param _user Wallet address to query
     */
    function getIdentity(address _user) external view returns (
        string memory identityHash,
        uint256 timestamp,
        bool isVerified
    ) {
        Identity memory id = identities[_user];
        return (id.identityHash, id.timestamp, id.verified);
    }

    /**
     * @dev Check if an address is verified (quick boolean check)
     */
    function isVerified(address _user) external view returns (bool) {
        return identities[_user].verified;
    }

    /**
     * @dev Revoke identity (owner-only for compliance scenarios)
     */
    function revokeIdentity(address _user) external onlyOwner {
        require(identities[_user].verified, "Not verified");
        identities[_user].verified = false;
        emit IdentityRevoked(_user, block.timestamp);
    }

    /**
     * @dev Get total number of verified identities
     */
    function getTotalVerified() external view returns (uint256) {
        return totalVerified;
    }
}
