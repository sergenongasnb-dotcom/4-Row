const http = require('http');
const fs = require('fs');
const url = require('url');

// Stockage des parties
const games = new Map();

function checkWin(board, row, col, player) {
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    for (let [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < 4; step++) {
            const r = row + dr * step, c = col + dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || !board[r] || board[r][c] !== player) break;
            count++;
        }
        for (let step = 1; step < 4; step++) {
            const r = row - dr * step, c = col - dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || !board[r] || board[r][c] !== player) break;
            count++;
        }
        if (count >= 4) return true;
    }
    return false;
}

const server = http.createServer(async (req, res) => {
    // CORS
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

    // === API ROUTES ===
    if (path === '/api/game') {
        const { action, id } = query;

        // LISTER
        if (req.method === 'GET' && action === 'list') {
            const available = Array.from(games.entries())
                .filter(([_, g]) => g.status === 'waiting' && g.players.length < 2)
                .map(([id, g]) => ({ id, players: g.players.length }));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, games: available }));
            return;
        }

        // CRÉER
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

        // REJOINDRE
        if (req.method === 'POST' && action === 'join' && id) {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                const game = games.get(id);
                if (!game) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ success: false, error: 'Partie non trouvée' }));
                    return;
                }
                
                if (game.players.length >= 2) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: 'Partie complète' }));
                    return;
                }
                
                game.players.push('yellow');
                game.status = 'playing';
                
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    gameId: id,
                    player: 'yellow',
                    game
                }));
            });
            return;
        }

        // JOUER
        if (req.method === 'POST' && action === 'move' && id) {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                const game = games.get(id);
                if (!game) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ success: false, error: 'Partie non trouvée' }));
                    return;
                }
                
                const { player, column } = JSON.parse(body);
                
                if (game.status !== 'playing') {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: 'Partie pas en cours' }));
                    return;
                }
                
                if (player !== game.currentPlayer) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: 'Pas ton tour' }));
                    return;
                }
                
                // Jouer le coup
                let rowPlayed = -1;
                for (let row = 5; row >= 0; row--) {
                    if (!game.board[row][column]) {
                        game.board[row][column] = player;
                        rowPlayed = row;
                        break;
                    }
                }
                
                if (rowPlayed === -1) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: 'Colonne pleine' }));
                    return;
                }
                
                const win = checkWin(game.board, rowPlayed, column, player);
                
                if (win) {
                    game.status = 'finished';
                    game.winner = player;
                } else {
                    game.currentPlayer = player === 'red' ? 'yellow' : 'red';
                }
                
                game.lastMove = { row: rowPlayed, column, player };
                
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    game
                }));
            });
            return;
        }

        // ÉTAT
        if (req.method === 'GET' && id) {
            const game = games.get(id);
            if (!game) {
                res.writeHead(404);
                res.end(JSON.stringify({ success: false, error: 'Partie non trouvée' }));
                return;
            }
            
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, game }));
            return;
        }
    }

    // === SERVIR index.html ===
    if (path === '/' || path === '/index.html') {
        fs.readFile('./index.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // 404 pour tout le reste
    res.writeHead(404);
    res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});