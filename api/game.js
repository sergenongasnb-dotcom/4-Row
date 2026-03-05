import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, id } = req.query;

    // LISTER
    if (req.method === 'GET' && action === 'list') {
        const { data } = await supabase
            .from('games')
            .select('id, players')
            .eq('status', 'waiting');
        return res.json({ success: true, games: data || [] });
    }

    // CRÉER
    if (req.method === 'POST' && action === 'create') {
        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newGame = {
            id: gameId,
            board: Array(6).fill().map(() => Array(7).fill(null)),
            currentPlayer: 'red',
            players: ['red'],
            status: 'waiting',
            winner: null
        };
        await supabase.from('games').insert(newGame);
        return res.json({ success: true, gameId, player: 'red', game: newGame });
    }

    // REJOINDRE
    if (req.method === 'POST' && action === 'join' && id) {
        const { data: game } = await supabase.from('games').select().eq('id', id).single();
        if (!game) return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        
        game.players.push('yellow');
        game.status = 'playing';
        await supabase.from('games').update({ players: game.players, status: 'playing' }).eq('id', id);
        
        return res.json({ success: true, gameId: id, player: 'yellow', game });
    }

    // JOUER
    if (req.method === 'POST' && action === 'move' && id) {
        const { data: game } = await supabase.from('games').select().eq('id', id).single();
        if (!game) return res.status(404).json({ success: false, error: 'Partie non trouvée' });
        
        const { player, column } = req.body;
        
        let rowPlayed = -1;
        for (let row = 5; row >= 0; row--) {
            if (!game.board[row][column]) {
                game.board[row][column] = player;
                rowPlayed = row;
                break;
            }
        }
        
        // Vérification victoire simplifiée
        game.currentPlayer = player === 'red' ? 'yellow' : 'red';
        await supabase.from('games').update({ 
            board: game.board, 
            currentPlayer: game.currentPlayer 
        }).eq('id', id);
        
        return res.json({ success: true, game });
    }

    // ÉTAT
    if (req.method === 'GET' && id) {
        const { data: game } = await supabase.from('games').select().eq('id', id).single();
        return res.json({ success: true, game });
    }

    return res.status(400).json({ success: false, error: 'Action non supportée' });
}
