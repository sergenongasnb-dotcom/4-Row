// api/game.js - Avec persistance mémoire + logs
const games = new Map();

export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, id } = req.query;

    // LISTER les parties disponibles
    if (req.method === 'GET' && action === 'list') {
        const available = Array.from(games.entries())
            .filter(([_, g]) => g.status === 'waiting' && g.players.length < 2)
            .map(([id, g]) => ({ id, players: g.players.length }));
        
        return res.status(200).json({ success: true, games: available });
    }

    // CRÉER une partie
    if (req.method === 'POST' && action === 'create') {
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
        
        console.log('Partie créée:', gameId, 'Total parties:', games.size);
        
        const game = games.get(gameId);
        return res.status(200).json({
            success: true,
            gameId,
            player: 'red',
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status,
                winner: game.winner
            }
        });
    }

    // REJOINDRE une partie
    if (req.method === 'POST' && action === 'join' && id) {
        const game = games.get(id);
        
        if (!game) {
            console.log('Partie non trouvée:', id);
            return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        }
        
        if (game.players.length >= 2) {
            return res.status(400).json({ success: false, error: 'Partie complète' });
        }
        
        game.players.push('yellow');
        game.status = 'playing';
        
        console.log('Joueur rejoint:', id, 'Joueurs:', game.players);
        
        return res.status(200).json({
            success: true,
            gameId: id,
            player: 'yellow',
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status,
                winner: game.winner
            }
        });
    }

    // JOUER un coup
    if (req.method === 'POST' && action === 'move' && id) {
        const game = games.get(id);
        if (!game) {
            console.log('Move: partie non trouvée', id);
            return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        }
        
        const { player, column } = req.body;
        
        if (game.status !== 'playing') {
            return res.status(400).json({ success: false, error: 'Partie pas en cours' });
        }
        
        if (player !== game.currentPlayer) {
            return res.status(400).json({ success: false, error: 'Pas ton tour' });
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
            return res.status(400).json({ success: false, error: 'Colonne pleine' });
        }
        
        // Vérifier victoire
        const win = checkWin(game.board, rowPlayed, column, player);
        
        if (win) {
            game.status = 'finished';
            game.winner = player;
        } else {
            game.currentPlayer = player === 'red' ? 'yellow' : 'red';
        }
        
        game.lastMove = { row: rowPlayed, column, player };
        
        return res.status(200).json({
            success: true,
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status,
                winner: game.winner,
                lastMove: game.lastMove
            }
        });
    }

    // RÉCUPÉRER état d'une partie
    if (req.method === 'GET' && id) {
        const game = games.get(id);
        if (!game) {
            console.log('GET: partie non trouvée', id);
            return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        }
        
        return res.status(200).json({
            success: true,
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status,
                winner: game.winner,
                lastMove: game.lastMove
            }
        });
    }

    return res.status(400).json({ 
        success: false, 
        error: 'Action non supportée'
    });
}

function checkWin(board, row, col, player) {
    const directions = [
        [0, 1], [1, 0], [1, 1], [1, -1]
    ];
    
    for (let [dr, dc] of directions) {
        let count = 1;
        
        for (let step = 1; step < 4; step++) {
            const r = row + dr * step;
            const c = col + dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) break;
            count++;
        }
        
        for (let step = 1; step < 4; step++) {
            const r = row - dr * step;
            const c = col - dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) break;
            count++;
        }
        
        if (count >= 4) return true;
    }
    return false;
}
// Ajoute ces lignes à la fin du fichier
if (require.main === module) {
    const http = require('http');
    const server = http.createServer((req, res) => {
        // Simule une requête Vercel
        handler(req, res);
    });
    server.listen(process.env.PORT || 3000);
}