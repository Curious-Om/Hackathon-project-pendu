const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data file path
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file if not exists
function initData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            admin: { username: 'admin', password: 'admin123' },
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

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const data = getData();
    
    if (username === data.admin.username && password === data.admin.password) {
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
    const data = getData();
    const newId = data.paragraphs.length > 0 ? Math.max(...data.paragraphs.map(p => p.id)) + 1 : 1;
    data.paragraphs.push({ id: newId, text });
    saveData(data);
    res.json({ success: true, id: newId });
});

// Update paragraph
app.put('/api/paragraphs/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { text } = req.body;
    const data = getData();
    const index = data.paragraphs.findIndex(p => p.id === id);
    if (index !== -1) {
        data.paragraphs[index].text = text;
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
    const data = getData();
    data.testState = {
        isActive: true,
        selectedParagraphId: paragraphId,
        timeLimit: timeLimit,
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
    const data = getData();
    
    const paragraph = data.paragraphs.find(p => p.id === data.testState.selectedParagraphId);
    if (!paragraph) {
        return res.status(400).json({ success: false, message: 'No active test' });
    }
    
    const originalText = paragraph.text;
    
    // Calculate accuracy
    let correctChars = 0;
    const minLength = Math.min(typedText.length, originalText.length);
    for (let i = 0; i < minLength; i++) {
        if (typedText[i] === originalText[i]) {
            correctChars++;
        }
    }
    const accuracy = originalText.length > 0 ? (correctChars / originalText.length) * 100 : 0;
    
    // Calculate speed (WPM - words per minute, assuming 5 chars = 1 word)
    const timeInMinutes = timeTaken / 60;
    const wordsTyped = typedText.length / 5;
    const wpm = timeInMinutes > 0 ? Math.round(wordsTyped / timeInMinutes) : 0;
    
    // Calculate CPM
    const cpm = timeInMinutes > 0 ? Math.round(typedText.length / timeInMinutes) : 0;
    
    // Final score (weighted: 60% accuracy, 40% speed normalized to 100 WPM max)
    const speedScore = Math.min(wpm / 100, 1) * 100;
    const finalScore = Math.round(accuracy * 0.6 + speedScore * 0.4);
    
    const result = {
        id: Date.now(),
        participantName,
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

// Serve pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'participant.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Blind Typing Test Server running at http://localhost:${PORT}`);
    console.log(`📝 Participant page: http://localhost:${PORT}`);
    console.log(`🔐 Admin dashboard: http://localhost:${PORT}/admin`);
});
