/**
 * POST /api/test/start
 * Starts the test with a selected paragraph and time limit.
 */
const store = require('../_store');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const { paragraphId, timeLimit } = req.body || {};
    const limit = parseInt(timeLimit);

    if (!paragraphId || isNaN(limit) || limit < 10 || limit > 600) {
        return res.status(400).json({ success: false, message: 'Invalid paragraphId or timeLimit (10–600s)' });
    }

    store.testState = {
        isActive: true,
        selectedParagraphId: parseInt(paragraphId),
        timeLimit: limit,
        startTime: Date.now()
    };

    return res.status(200).json({ success: true });
};
