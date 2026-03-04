// api/game.js - Version complète et stable
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

    // TEST : vérifier que l'API fonctionne
    if (req.method === 'GET' && !action) {
        return res.status(200).json({ success: true, message: "API OK" });
    }

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
            winner: null
        });
        
        return res.status(200).json({
            success: true,
            gameId,
            player: 'red',
            game: {
                board: Array(6).fill().map(() => Array(7).fill(null)),
                currentPlayer: 'red',
                players: ['red'],
                status: 'waiting'
            }
        });
    }

    // REJOINDRE une partie
    if (req.method === 'POST' && action === 'join' && id) {
        const game = games.get(id);
        
        if (!game) {
            return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        }
        
        if (game.players.length >= 2) {
            return res.status(400).json({ success: false, error: 'Partie complète' });
        }
        
        game.players.push('yellow');
        game.status = 'playing';
        
        return res.status(200).json({
            success: true,
            gameId: id,
            player: 'yellow',
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status
            }
        });
    }

    // JOUER un coup
    if (req.method === 'POST' && action === 'move' && id) {
        const game = games.get(id);
        if (!game) {
            return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        }
        
        const { player, column } = req.body;
        
        if (game.status !== 'playing') {
            return res.status(400).json({ success: false, error: 'Partie pas en cours' });
        }
        
        if (player !== game.currentPlayer) {
            return res.status(400).json({ success: false, error: 'Pas ton tour' });
        }
        
        // Logique du coup (simplifiée)
        for (let row = 5; row >= 0; row--) {
            if (!game.board[row][column]) {
                game.board[row][column] = player;
                game.currentPlayer = player === 'red' ? 'yellow' : 'red';
                break;
            }
        }
        
        return res.status(200).json({
            success: true,
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                status: game.status,
                players: game.players
            }
        });
    }

    // RÉCUPÉRER état d'une partie
    if (req.method === 'GET' && id) {
        const game = games.get(id);
        if (!game) {
            return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        }
        
        return res.status(200).json({
            success: true,
            game: {
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status,
                winner: game.winner
            }
        });
    }

    return res.status(400).json({ 
        success: false, 
        error: 'Action non supportée',
        received: { method: req.method, action, id }
    });
}