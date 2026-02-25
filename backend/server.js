// backend/server.js
// ─── ChainID Backend API ──────────────────────────────────────────────────────

const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chainid';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ─── Schema ───────────────────────────────────────────────────────────────────
const verificationSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, lowercase: true },
  identityHash:  { type: String, required: true },
  txHash:        { type: String, required: true },
  blockNumber:   { type: Number },
  docType:       { type: String },
  nationality:   { type: String },
  status:        { type: String, default: 'verified', enum: ['verified','revoked'] },
  timestamp:     { type: Date, default: Date.now },
  createdAt:     { type: Date, default: Date.now }
});
const Verification = mongoose.model('Verification', verificationSchema);

// ─── Web3 + Contract (optional — for server-side chain reads) ─────────────────
let web3, contract;
try {
  // Web3 v1 style — works with "web3": "^1.10.0"
  const Web3Lib = require('web3');
  web3 = new Web3Lib(process.env.GANACHE_URL || 'http://127.0.0.1:7545');
  console.log('✅ Web3 connected to Ganache');

  const CONTRACT_ABI = [
    {"inputs":[{"internalType":"string","name":"_identityHash","type":"string"}],"name":"verifyIdentity","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getIdentity","outputs":[{"internalType":"string","name":"","type":"string"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"isVerified","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}
  ];

  if (process.env.CONTRACT_ADDRESS) {
    contract = new web3.eth.Contract(CONTRACT_ABI, process.env.CONTRACT_ADDRESS);
    console.log('✅ Contract loaded:', process.env.CONTRACT_ADDRESS);
  }
} catch(e) {
  console.warn('⚠️  Web3 init skipped:', e.message);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ status: 'ChainID Backend Running 🚀', timestamp: new Date() });
});

// Save verification after blockchain TX
app.post('/api/verify', async (req, res) => {
  try {
    const { walletAddress, identityHash, txHash, blockNumber, docType, nationality, timestamp } = req.body;
    if (!walletAddress || !identityHash || !txHash)
      return res.status(400).json({ error: 'Missing required fields' });

    const existing = await Verification.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (existing)
      return res.status(409).json({ error: 'Wallet already verified' });

    const record = new Verification({
      walletAddress: walletAddress.toLowerCase(),
      identityHash, txHash, blockNumber, docType, nationality,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    await record.save();
    console.log(`✅ Saved: ${walletAddress}`);

    res.status(201).json({
      success: true,
      data: { walletAddress: record.walletAddress, txHash: record.txHash, blockNumber: record.blockNumber }
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get verification status by wallet
app.get('/api/verify/:walletAddress', async (req, res) => {
  try {
    const addr = req.params.walletAddress.toLowerCase();
    const record = await Verification.findOne({ walletAddress: addr });
    if (!record) return res.status(404).json({ verified: false, message: 'No record found' });

    let onChainStatus = null;
    if (contract) {
      try { onChainStatus = await contract.methods.isVerified(req.params.walletAddress).call(); }
      catch(e) { onChainStatus = 'unavailable'; }
    }

    res.json({
      verified: record.status === 'verified',
      walletAddress: record.walletAddress,
      docType: record.docType,
      nationality: record.nationality,
      txHash: record.txHash,
      blockNumber: record.blockNumber,
      timestamp: record.timestamp,
      onChainStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const total = await Verification.countDocuments({ status: 'verified' });
    const recent = await Verification.find().sort({ createdAt: -1 }).limit(5).select('walletAddress docType timestamp -_id');
    res.json({ totalVerified: total, recent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// All records
app.get('/api/all', async (req, res) => {
  try {
    const records = await Verification.find().sort({ createdAt: -1 });
    res.json({ count: records.length, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   ChainID Backend Running ✅          ║
  ║   http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝`);
});
