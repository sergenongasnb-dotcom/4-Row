const http = require('http');
const fs = require('fs');
const url = require('url');

// Stockage des parties normales
const games = new Map();

// Stockage des matchs de tournoi
const matchs = new Map();

// Créer tous les matchs du tournoi
function initTournoi() {
    // Huitièmes de finale (8 matchs)
    for (let i = 1; i <= 8; i++) {
        const matchId = `8EME${i}`;
        matchs.set(matchId, {
            id: matchId,
            joueurs: [null, null],
            gagnant: null,
            statut: "en-attente",
            board: Array(6).fill().map(() => Array(7).fill(null)),
            currentPlayer: 'red',
            dernierCoup: null,
            spectateurs: 0,
            phase: "huitieme"
        });
    }

    // Quarts de finale (4 matchs)
    for (let i = 1; i <= 4; i++) {
        const matchId = `QUART${i}`;
        matchs.set(matchId, {
            id: matchId,
            joueurs: [null, null],
            gagnant: null,
            statut: "en-attente",
            board: Array(6).fill().map(() => Array(7).fill(null)),
            currentPlayer: 'red',
            dernierCoup: null,
            spectateurs: 0,
            phase: "quart",
            precedent: [`8EME${i*2-1}`, `8EME${i*2}`] // Quels matchs nourrissent ce quart
        });
    }

    // Demi-finales (2 matchs)
    for (let i = 1; i <= 2; i++) {
        const matchId = `DEMI${i}`;
        matchs.set(matchId, {
            id: matchId,
            joueurs: [null, null],
            gagnant: null,
            statut: "en-attente",
            board: Array(6).fill().map(() => Array(7).fill(null)),
            currentPlayer: 'red',
            dernierCoup: null,
            spectateurs: 0,
            phase: "demi",
            precedent: [`QUART${i*2-1}`, `QUART${i*2}`]
        });
    }

    // Petite finale (3ème place)
    matchs.set("TROISIEME", {
        id: "TROISIEME",
        joueurs: [null, null],
        gagnant: null,
        statut: "en-attente",
        board: Array(6).fill().map(() => Array(7).fill(null)),
        currentPlayer: 'red',
        dernierCoup: null,
        spectateurs: 0,
        phase: "petite-finale",
        precedent: ["DEMI1", "DEMI2"] // Les perdants des demies
    });

    // Finale
    matchs.set("FINALE", {
        id: "FINALE",
        joueurs: [null, null],
        gagnant: null,
        statut: "en-attente",
        board: Array(6).fill().map(() => Array(7).fill(null)),
        currentPlayer: 'red',
        dernierCoup: null,
        spectateurs: 0,
        phase: "finale",
        precedent: ["DEMI1", "DEMI2"] // Les gagnants des demies
    });

    console.log("🏆 Tournoi initialisé avec :");
    console.log("   - 8 huitièmes");
    console.log("   - 4 quarts");
    console.log("   - 2 demies");
    console.log("   - 1 petite finale");
    console.log("   - 1 finale");
}

initTournoi();

function checkWin(board, row, col, player) {
    const directions = [
        [0, 1],   // horizontal
        [1, 0],   // vertical
        [1, 1],   // diagonale \
        [1, -1]   // diagonale /
    ];
    
    for (let [dr, dc] of directions) {
        let count = 1;
        
        // Direction positive
        for (let step = 1; step < 4; step++) {
            const r = row + dr * step;
            const c = col + dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || !board[r] || board[r][c] !== player) break;
            count++;
        }
        
        // Direction négative
        for (let step = 1; step < 4; step++) {
            const r = row - dr * step;
            const c = col - dc * step;
            if (r < 0 || r >= 6 || c < 0 || c >= 7 || !board[r] || board[r][c] !== player) break;
            count++;
        }
        
        if (count >= 4) return true;
    }
    return false;
}

const server = http.createServer((req, res) => {
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ==================== API TOURNOI ====================

    // Route pour réinitialiser le tournoi
    if (path === '/api/reset-tournoi' && req.method === 'POST') {
        matchs.clear();
        initTournoi();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Tournoi réinitialisé' }));
        return;
    }

    // Route pour obtenir la liste des matchs
    if (path === '/api/matchs') {
        const listeMatchs = Array.from(matchs.entries()).map(([id, match]) => ({
            id: match.id,
            joueurs: match.joueurs,
            gagnant: match.gagnant,
            statut: match.statut,
            phase: match.phase
        }));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, matchs: listeMatchs }));
        return;
    }

    // Route pour un match spécifique
    if (path === '/api/match' && query.id) {
        // Si le match n'existe pas, le créer (pour les matchs exhibition)
        if (!matchs.has(query.id)) {
            matchs.set(query.id, {
                id: query.id,
                joueurs: [null, null],
                gagnant: null,
                statut: "en-attente",
                board: Array(6).fill().map(() => Array(7).fill(null)),
                currentPlayer: 'red',
                dernierCoup: null,
                spectateurs: 0,
                phase: "exhibition"
            });
        }

        const match = matchs.get(query.id);
        if (!match) {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'Match non trouvé' }));
            return;
        }

        if (req.method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, match }));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { action, joueur, player, column } = JSON.parse(body);

                    if (action === 'rejoindre') {
                        // Vérifier si le joueur est déjà dans le match
                        if (match.joueurs[0] === joueur || match.joueurs[1] === joueur) {
                            // C'est le même joueur qui revient
                            res.writeHead(200);
                            res.end(JSON.stringify({ success: true, match }));
                            return;
                        }

                        // Nouveau joueur
                        if (match.joueurs[0] === null) {
                            match.joueurs[0] = joueur;
                        } else if (match.joueurs[1] === null) {
                            match.joueurs[1] = joueur;
                            match.statut = "en-cours";
                        } else {
                            match.spectateurs++;
                        }
                        
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, match }));
                    }

                    else if (action === 'jouer') {
                        // Vérifier que c'est bien le tour du joueur
                        if (player !== match.currentPlayer) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: 'Pas ton tour' }));
                            return;
                        }

                        // Vérifier que la partie est en cours
                        if (match.statut !== 'en-cours') {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: 'Partie pas en cours' }));
                            return;
                        }

                        // Jouer le coup
                        let rowPlayed = -1;
                        for (let row = 5; row >= 0; row--) {
                            if (!match.board[row][column]) {
                                match.board[row][column] = player;
                                rowPlayed = row;
                                break;
                            }
                        }
                        
                        if (rowPlayed === -1) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: 'Colonne pleine' }));
                            return;
                        }
                        
                        // Vérifier victoire
                        const win = checkWin(match.board, rowPlayed, column, player);
                        
                        if (win) {
                            match.statut = "termine";
                            match.gagnant = player;
                            
                            // Si c'est un match de tournoi, propager aux phases suivantes
                            if (match.phase && match.phase !== "exhibition") {
                                propagerGagnant(match.id, player);
                            }
                        } else {
                            match.currentPlayer = player === 'red' ? 'yellow' : 'red';
                        }
                        
                        match.dernierCoup = { row: rowPlayed, column, player };
                        
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, match }));
                    }

                    else if (action === 'fin') {
                        match.gagnant = joueur;
                        match.statut = "termine";
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, match }));
                    }

                    else {
                        res.writeHead(400);
                        res.end(JSON.stringify({ success: false, error: 'Action inconnue' }));
                    }

                } catch (e) {
                    console.error(e);
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, error: 'Bad request' }));
                }
            });
            return;
        }
    }

    // Fonction pour propager le gagnant aux phases suivantes
    function propagerGagnant(matchId, player) {
        for (const [id, match] of matchs.entries()) {
            if (match.precedent && match.precedent.includes(matchId)) {
                // C'est le match suivant
                if (player === 'red') {
                    match.joueurs[0] = matchs.get(matchId).joueurs[0];
                } else {
                    match.joueurs[1] = matchs.get(matchId).joueurs[1];
                }
                
                // Si les deux joueurs sont là, démarrer
                if (match.joueurs[0] && match.joueurs[1]) {
                    match.statut = "en-cours";
                }
            }
        }
    }

    // ==================== JEU NORMAL ====================
    
    // Route pour API game normale
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

    // ==================== PAGES HTML ====================

    // Page d'accueil
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

    // Page match de tournoi (pour n'importe quel ID)
    if (path.startsWith('/match/')) {
        fs.readFile('./match.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Erreur chargement match');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // Page tournoi public
    if (path === '/tournoi') {
        fs.readFile('./tournoi.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Erreur chargement tournoi');
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
    console.log(`✅ Serveur démarré sur port ${PORT}`);
});
