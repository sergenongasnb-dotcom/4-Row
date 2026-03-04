// api/game.js
// Stockage en mémoire (attention: Vercel peut reset entre les requêtes)
// Pour de la persistance réelle, utiliser une base de données (voir notes à la fin)
const games = new Map();

// Configuration CORS pour permettre l'accès depuis le frontend
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

export default function handler(req, res) {
    // Gérer préflight CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        return res.end();
    }

    // Set headers pour toutes les réponses
    Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
    });

    const { method, query, body } = req;
    const action = query.action || (body && body.action);

    // Route: GET /api/game?action=list
    if (method === 'GET' && action === 'list') {
        // Liste des parties disponibles (en attente)
        const availableGames = Array.from(games.entries())
            .filter(([id, game]) => game.status === 'waiting' && game.players.length < 2)
            .map(([id, game]) => ({
                id,
                createdAt: game.createdAt,
                players: game.players.length
            }));
        
        return res.status(200).json({ 
            success: true, 
            games: availableGames 
        });
    }

    // Route: GET /api/game?id=XXX
    if (method === 'GET' && query.id) {
        const game = games.get(query.id);
        if (!game) {
            return res.status(404).json({ 
                success: false, 
                error: 'Partie non trouvée' 
            });
        }

        // Retourner l'état de la partie (sans données sensibles)
        return res.status(200).json({
            success: true,
            game: {
                id: query.id,
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status,
                winner: game.winner,
                lastMove: game.lastMove
            }
        });
    }

    // Route: POST /api/game?action=create
    if (method === 'POST' && action === 'create') {
        const gameId = generateGameId();
        const newGame = {
            id: gameId,
            board: createEmptyBoard(),
            currentPlayer: 'red', // rouge commence toujours
            players: ['red'], // créateur = rouge
            status: 'waiting', // waiting, playing, finished
            winner: null,
            createdAt: Date.now(),
            lastMove: null,
            moves: [] // historique
        };

        games.set(gameId, newGame);
        
        return res.status(201).json({
            success: true,
            gameId,
            player: 'red',
            game: newGame
        });
    }

    // Route: POST /api/game?action=join&id=XXX
    if (method === 'POST' && action === 'join' && query.id) {
        const game = games.get(query.id);
        
        if (!game) {
            return res.status(404).json({ 
                success: false, 
                error: 'Partie non trouvée' 
            });
        }

        if (game.players.length >= 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'Partie déjà complète' 
            });
        }

        if (game.status !== 'waiting') {
            return res.status(400).json({ 
                success: false, 
                error: 'Partie déjà commencée' 
            });
        }

        // Ajouter le joueur jaune
        game.players.push('yellow');
        game.status = 'playing';

        return res.status(200).json({
            success: true,
            gameId: query.id,
            player: 'yellow',
            game: {
                id: game.id,
                board: game.board,
                currentPlayer: game.currentPlayer,
                players: game.players,
                status: game.status
            }
        });
    }

    // Route: POST /api/game?action=move&id=XXX
    if (method === 'POST' && action === 'move' && query.id) {
        const game = games.get(query.id);
        
        if (!game) {
            return res.status(404).json({ 
                success: false, 
                error: 'Partie non trouvée' 
            });
        }

        if (game.status !== 'playing') {
            return res.status(400).json({ 
                success: false, 
                error: 'Partie non en cours' 
            });
        }

        const { player, column } = body;

        // Validation du joueur
        if (!player || !game.players.includes(player)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Joueur non autorisé' 
            });
        }

        // Vérifier que c'est bien son tour
        if (player !== game.currentPlayer) {
            return res.status(400).json({ 
                success: false, 
                error: 'Ce n\'est pas votre tour',
                currentPlayer: game.currentPlayer
            });
        }

        // Validation de la colonne
        if (column === undefined || column < 0 || column >= 7) {
            return res.status(400).json({ 
                success: false, 
                error: 'Colonne invalide' 
            });
        }

        // Vérifier si la colonne n'est pas pleine
        if (game.board[0][column] !== null) {
            return res.status(400).json({ 
                success: false, 
                error: 'Colonne pleine' 
            });
        }

        // Jouer le coup
        const moveResult = playMove(game, column, player);
        
        if (!moveResult.success) {
            return res.status(400).json({ 
                success: false, 
                error: moveResult.error 
            });
        }

        // Sauvegarder le dernier mouvement
        game.lastMove = {
            player,
            column,
            row: moveResult.row,
            timestamp: Date.now()
        };
        
        game.moves.push(game.lastMove);

        // Vérifier victoire
        if (moveResult.win) {
            game.status = 'finished';
            game.winner = player;
        } 
        // Vérifier match nul (plateau plein)
        else if (isBoardFull(game.board)) {
            game.status = 'finished';
            game.winner = null; // match nul
        }
        else {
            // Changer de joueur
            game.currentPlayer = player === 'red' ? 'yellow' : 'red';
        }

        return res.status(200).json({
            success: true,
            game: {
                id: game.id,
                board: game.board,
                currentPlayer: game.currentPlayer,
                status: game.status,
                winner: game.winner,
                lastMove: game.lastMove
            }
        });
    }

    // Route: POST /api/game?action=reset&id=XXX
    if (method === 'POST' && action === 'reset' && query.id) {
        const game = games.get(query.id);
        
        if (!game) {
            return res.status(404).json({ 
                success: false, 
                error: 'Partie non trouvée' 
            });
        }

        // Réinitialiser le plateau mais garder les joueurs
        game.board = createEmptyBoard();
        game.currentPlayer = 'red';
        game.status = 'playing';
        game.winner = null;
        game.lastMove = null;
        game.moves = [];

        return res.status(200).json({
            success: true,
            game: {
                id: game.id,
                board: game.board,
                currentPlayer: game.currentPlayer,
                status: game.status,
                players: game.players
            }
        });
    }

    // Route par défaut: méthode non supportée
    return res.status(405).json({ 
        success: false, 
        error: 'Méthode ou action non supportée' 
    });
}

// -------------------- FONCTIONS UTILITAIRES --------------------

function generateGameId() {
    // Génère un ID de 6 caractères (facile à partager)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

function createEmptyBoard() {
    return Array(6).fill().map(() => Array(7).fill(null));
}

function playMove(game, column, player) {
    const board = game.board;
    const rows = 6;

    // Trouver la ligne la plus basse disponible
    for (let row = rows - 1; row >= 0; row--) {
        if (board[row][column] === null) {
            board[row][column] = player;
            
            // Vérifier si ce coup est gagnant
            const win = checkWin(board, row, column, player);
            
            return {
                success: true,
                row,
                win
            };
        }
    }

    return {
        success: false,
        error: 'Colonne pleine'
    };
}

function checkWin(board, row, col, player) {
    const directions = [
        { dr: 0, dc: 1 },  // horizontal
        { dr: 1, dc: 0 },  // vertical
        { dr: 1, dc: 1 },  // diagonale \
        { dr: 1, dc: -1 }  // diagonale /
    ];

    for (let { dr, dc } of directions) {
        let count = 1;

        // Direction positive
        for (let step = 1; step < 4; step++) {
            const r = row + dr * step;
            const c = col + dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r]?.[c] !== player) break;
            count++;
        }

        // Direction négative
        for (let step = 1; step < 4; step++) {
            const r = row - dr * step;
            const c = col - dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r]?.[c] !== player) break;
            count++;
        }

        if (count >= 4) return true;
    }

    return false;
}

function isBoardFull(board) {
    return board[0].every(cell => cell !== null);
}

// -------------------- NETTOYAGE DES PARTIES ANCIENNES --------------------
// Optionnel: nettoyer les parties inactives toutes les heures
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        
        for (const [id, game] of games.entries()) {
            // Supprimer les parties terminées de plus d'une heure
            if (game.status === 'finished' && (now - game.lastMove?.timestamp || now) > ONE_HOUR) {
                games.delete(id);
            }
            // Supprimer les parties en attente de plus d'une heure
            if (game.status === 'waiting' && (now - game.createdAt) > ONE_HOUR) {
                games.delete(id);
            }
        }
    }, ONE_HOUR);
}
