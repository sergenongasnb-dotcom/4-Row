const http = require('http');
const url = require('url');
const games = new Map();

function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    // API routes
    if (path === '/api/game') {
        const { action, id } = query;

        if (req.method === 'GET' && action === 'list') {
            const available = Array.from(games.entries())
                .filter(([_, g]) => g.status === 'waiting' && g.players.length < 2)
                .map(([id, g]) => ({ id, players: g.players.length }));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, games: available }));
            return;
        }

        if (req.method === 'POST' && action === 'create') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
                games.set(gameId, {
                    board: Array(6).fill().map(() => Array(7).fill(null)),
                    currentPlayer: 'red',
                    players: ['red'],
                    status: 'waiting',
                    winner: null,
                    lastMove: null,
                    createdAt: Date.now()
                });
                
                const game = games.get(gameId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    gameId,
                    player: 'red',
                    game
                }));
            });
            return;
        }

        // Ajoute les autres routes ici (join, move, etc)
    }

    // Servir index.html pour tout le reste
    if (path === '/' || !path.startsWith('/api')) {
        const fs = require('fs');
        fs.readFile('./index.html', (err, data) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    res.writeHead(404);
    res.end();
}

const port = process.env.PORT || 3000;
http.createServer(handler).listen(port, () => {
    console.log(`Server running on port ${port}`);
});