require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter for AI endpoint
// Tracks: { ip -> { count, windowStart } }
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 10;        // max requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // per 1 minute

function aiRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        // New window
        rateLimitStore.set(ip, { count: 1, windowStart: now });
        return next();
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({
            success: false,
            message: `Rate limit exceeded. Max ${RATE_LIMIT_MAX} AI generations per minute.`
        });
    }

    entry.count++;
    next();
}

// ==================== DATA LAYER ====================
const DATA_FILE = path.join(__dirname, 'data.json');

function initData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            paragraphs: [
                { id: 1, text: 'The quick brown fox jumps over the lazy dog. This is a simple typing test.' },
                { id: 2, text: 'Programming is the art of telling another human what one wants the computer to do.' }
            ],
            testState: {
                isActive: false,
                selectedParagraphId: null,
                timeLimit: 60,
                startTime: null
            },
            results: []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

function getData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

initData();

// ==================== ADMIN ROUTES ====================

// Admin Login — credentials now come from .env
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const validUser = process.env.ADMIN_USERNAME || 'admin';
    const validPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === validUser && password === validPass) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all paragraphs
app.get('/api/paragraphs', (req, res) => {
    const data = getData();
    res.json(data.paragraphs);
});

// Add paragraph
app.post('/api/paragraphs', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
        return res.status(400).json({ success: false, message: 'Paragraph text must be at least 10 characters' });
    }
    if (text.trim().length > 2000) {
        return res.status(400).json({ success: false, message: 'Paragraph text must be under 2000 characters' });
    }

    const data = getData();
    const newId = data.paragraphs.length > 0 ? Math.max(...data.paragraphs.map(p => p.id)) + 1 : 1;
    data.paragraphs.push({ id: newId, text: text.trim() });
    saveData(data);
    res.json({ success: true, id: newId });
});

// Update paragraph
app.put('/api/paragraphs/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
        return res.status(400).json({ success: false, message: 'Paragraph text must be at least 10 characters' });
    }

    const data = getData();
    const index = data.paragraphs.findIndex(p => p.id === id);
    if (index !== -1) {
        data.paragraphs[index].text = text.trim();
        saveData(data);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Paragraph not found' });
    }
});

// Delete paragraph
app.delete('/api/paragraphs/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const data = getData();
    data.paragraphs = data.paragraphs.filter(p => p.id !== id);
    saveData(data);
    res.json({ success: true });
});

// ==================== TEST CONTROL ROUTES ====================

// Get test state
app.get('/api/test/state', (req, res) => {
    const data = getData();
    const paragraph = data.paragraphs.find(p => p.id === data.testState.selectedParagraphId);
    res.json({
        ...data.testState,
        paragraph: paragraph ? paragraph.text : null
    });
});

// Start test
app.post('/api/test/start', (req, res) => {
    const { paragraphId, timeLimit } = req.body;

    const limit = parseInt(timeLimit);
    if (!paragraphId || isNaN(limit) || limit < 10 || limit > 600) {
        return res.status(400).json({ success: false, message: 'Invalid paragraphId or timeLimit (10–600s)' });
    }

    const data = getData();
    data.testState = {
        isActive: true,
        selectedParagraphId: paragraphId,
        timeLimit: limit,
        startTime: Date.now()
    };
    saveData(data);
    res.json({ success: true });
});

// Stop test
app.post('/api/test/stop', (req, res) => {
    const data = getData();
    data.testState.isActive = false;
    saveData(data);
    res.json({ success: true });
});

// ==================== RESULTS ROUTES ====================

// Submit result
app.post('/api/results', (req, res) => {
    const { participantName, typedText, timeTaken } = req.body;

    if (!participantName || typeof participantName !== 'string' || participantName.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid participant name' });
    }
    if (typeof typedText !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid typed text' });
    }
    if (typeof timeTaken !== 'number' || timeTaken <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid time taken' });
    }

    const data = getData();
    const paragraph = data.paragraphs.find(p => p.id === data.testState.selectedParagraphId);
    if (!paragraph) {
        return res.status(400).json({ success: false, message: 'No active test paragraph found' });
    }

    const originalText = paragraph.text;

    // Calculate accuracy
    let correctChars = 0;
    const minLength = Math.min(typedText.length, originalText.length);
    for (let i = 0; i < minLength; i++) {
        if (typedText[i] === originalText[i]) correctChars++;
    }
    const accuracy = originalText.length > 0 ? (correctChars / originalText.length) * 100 : 0;

    // Calculate speed
    const timeInMinutes = timeTaken / 60;
    const wpm = timeInMinutes > 0 ? Math.round((typedText.length / 5) / timeInMinutes) : 0;
    const cpm = timeInMinutes > 0 ? Math.round(typedText.length / timeInMinutes) : 0;

    // Final score: 60% accuracy + 40% speed (capped at 100 WPM)
    const speedScore = Math.min(wpm / 100, 1) * 100;
    const finalScore = Math.round(accuracy * 0.6 + speedScore * 0.4);

    const result = {
        id: Date.now(),
        participantName: participantName.trim(),
        wpm,
        cpm,
        accuracy: Math.round(accuracy * 100) / 100,
        finalScore,
        timestamp: new Date().toISOString()
    };

    data.results.push(result);
    saveData(data);
    res.json({ success: true, result });
});

// Get all results
app.get('/api/results', (req, res) => {
    const data = getData();
    res.json(data.results.sort((a, b) => b.id - a.id));
});

// Clear all results
app.delete('/api/results', (req, res) => {
    const data = getData();
    data.results = [];
    saveData(data);
    res.json({ success: true });
});

// ==================== AI HELPERS ====================

// Free, non-reasoning models confirmed working on OpenRouter.
// Order matters: primary first, fallbacks after.
const FREE_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free'
];

/**
 * Call OpenRouter with automatic model fallback.
 * Returns { text, model } on success or throws on total failure.
 */
async function callOpenRouter(systemPrompt, userPrompt, apiKey, { temperature = 0.8, maxTokens = 300 } = {}) {
    let lastError = null;

    for (const model of FREE_MODELS) {
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Blind Typing Test'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: userPrompt }
                    ],
                    temperature,
                    max_tokens: maxTokens
                })
            });

            const data = await res.json();

            if (!res.ok) {
                lastError = data?.error?.message || `HTTP ${res.status} from ${model}`;
                console.warn(`[AI] ${model} → ${res.status}, trying next`);
                continue;
            }

            const text = data?.choices?.[0]?.message?.content?.trim();
            if (!text || text.length < 15) {
                lastError = `${model} returned empty content`;
                console.warn(`[AI] ${model} → empty content, trying next`);
                continue;
            }

            console.log(`[AI] Success with model: ${model}`);
            return { text, model };

        } catch (err) {
            lastError = err.message;
            console.warn(`[AI] ${model} → fetch error: ${err.message}, trying next`);
        }
    }

    throw new Error(lastError || 'All AI models failed. Please try again.');
}

// ==================== AI PROXY ROUTE — PARAGRAPH GENERATION ====================
// The API key never leaves the server.
// Uses system + user prompt split and difficulty tiers for better prompt engineering.

app.post('/api/generate-paragraph', aiRateLimit, async (req, res) => {
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ success: false, message: 'AI service is not configured on the server.' });
    }

    const { topic, includePunctuation, includeNumbers, difficulty } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Topic is required' });
    }
    if (topic.trim().length > 100) {
        return res.status(400).json({ success: false, message: 'Topic must be under 100 characters' });
    }

    // Sanitize topic: strip quotes and backslashes to prevent prompt injection
    const safeTopic = topic.trim().replace(/['"\\`]/g, '');

    // System prompt defines the role and output contract
    const systemPrompt = `You are a typing test content generator. Your only job is to output a single plain-text paragraph suitable for a typing speed test. Rules:
- Output ONLY the paragraph. No titles, labels, quotes, markdown, or explanations.
- The paragraph must be 2–4 sentences, between 50 and 80 words.
- It must be factually accurate and grammatically correct.
- It must be interesting and suitable for all ages.`;

    // User prompt encodes the specific request with difficulty and options
    const difficultyInstructions = {
        easy:   'Use simple, everyday words (Grade 4–5 reading level). Keep sentences short and direct. Avoid jargon or complex vocabulary.',
        medium: 'Use moderately varied vocabulary (Grade 7–8 reading level). Mix short and medium-length sentences.',
        hard:   'Use sophisticated vocabulary, longer complex sentences, and precise terminology (Grade 11+ reading level). Include subordinate clauses.'
    };
    const difficultyHint = difficultyInstructions[difficulty] || difficultyInstructions.medium;

    let userPrompt = `Write a typing test paragraph about: ${safeTopic}\n\nDifficulty: ${difficultyHint}`;

    if (includePunctuation === false) {
        userPrompt += '\nPunctuation: Use only periods at sentence ends. No commas, colons, semicolons, dashes, or parentheses.';
    }
    if (includeNumbers === true) {
        userPrompt += '\nNumbers: Naturally include at least one specific number (a statistic, year, or quantity).';
    }

    // Few-shot example to anchor output format
    userPrompt += `\n\nExample of correct output format:\nThe ocean covers more than 70 percent of Earth's surface and contains 97 percent of the planet's water. Marine ecosystems support an estimated 700,000 to one million species, many of which remain undiscovered. The deep ocean, below 200 metres, is one of the least explored regions on Earth.\n\nNow write the paragraph:`;

    try {
        const { text, model } = await callOpenRouter(systemPrompt, userPrompt, API_KEY);

        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount < 10) {
            return res.status(502).json({ success: false, message: 'AI returned too short a paragraph. Try again.' });
        }

        res.json({ success: true, text, model });

    } catch (err) {
        console.error('[AI Proxy] generate-paragraph error:', err.message);
        res.status(502).json({ success: false, message: err.message });
    }
});

// ==================== AI PROXY ROUTE — POST-TEST FEEDBACK ====================
// Generates personalized feedback for a participant after their test.
// This is the key AI-as-a-feature integration: the app's own performance data
// is fed back to the AI to produce actionable, personalised coaching.

app.post('/api/ai-feedback', aiRateLimit, async (req, res) => {
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ success: false, message: 'AI service not configured.' });
    }

    const { participantName, wpm, accuracy, finalScore, difficulty } = req.body;

    // Input validation
    if (!participantName || typeof wpm !== 'number' || typeof accuracy !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid feedback request data.' });
    }

    const safeName = String(participantName).replace(/['"\\`<>]/g, '').substring(0, 50);
    const diffLabel = difficulty || 'medium';

    const systemPrompt = `You are a supportive typing coach giving brief, personalised post-test feedback. Be concise, encouraging, and specific. Always give one concrete improvement tip. Output exactly 2 sentences — no more, no less. No greetings, no sign-offs.`;

    const userPrompt = `Participant: ${safeName}
Test difficulty: ${diffLabel}
WPM (words per minute): ${wpm}
Accuracy: ${accuracy.toFixed(1)}%
Final score: ${finalScore}

Benchmarks for context:
- Beginner: <30 WPM, <80% accuracy
- Intermediate: 30–60 WPM, 80–94% accuracy  
- Advanced: >60 WPM, >95% accuracy

Write 2 sentences of personalised feedback and one specific actionable tip for this participant.`;

    try {
        const { text } = await callOpenRouter(systemPrompt, userPrompt, API_KEY, {
            temperature: 0.7,
            maxTokens: 120
        });

        res.json({ success: true, feedback: text });

    } catch (err) {
        console.error('[AI Feedback] error:', err.message);
        res.status(502).json({ success: false, message: err.message });
    }
});

// ==================== PAGE ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'participant.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Blind Typing Test running at http://localhost:${PORT}`);
    console.log(`📝 Participant: http://localhost:${PORT}`);
    console.log(`🔐 Admin:       http://localhost:${PORT}/admin`);
    console.log(`🤖 AI key:      ${process.env.OPENROUTER_API_KEY ? '✅ Loaded (OpenRouter)' : '❌ MISSING — set OPENROUTER_API_KEY in .env'}`);
});
