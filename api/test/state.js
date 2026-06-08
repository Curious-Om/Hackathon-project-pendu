/**
 * GET /api/test/state
 * Returns the current test state including the paragraph text if active.
 */
const store = require('../_store');

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const paragraph = store.paragraphs.find(p => p.id === store.testState.selectedParagraphId);

    return res.status(200).json({
        ...store.testState,
        paragraph: paragraph ? paragraph.text : null
    });
};
