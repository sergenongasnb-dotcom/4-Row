// api/game.js - Version simplifiée
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

    // TEST : simple vérification que l'API fonctionne
    if (req.method === 'GET' && !action) {
        return res.status(200).json({ 
            success: true, 
            message: "API fonctionne",
            query: req.query 
        });
    }

    // Créer une partie
    if (req.method === 'POST' && action === 'create') {
        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        games.set(gameId, {
            board: Array(6).fill().map(() => Array(7).fill(null)),
            currentPlayer: 'red',
            players: ['red'],
            status: 'waiting'
        });
        
        return res.status(200).json({
            success: true,
            gameId,
            player: 'red'
        });
    }

    return res.status(200).json({ 
        success: false, 
        error: 'Action non supportée',
        received: { method: req.method, action, id }
    });
}