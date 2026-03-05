import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// Initialisation Supabase avec les variables d'env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Variables Supabase manquantes');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, id } = req.query;

    try {
        // LISTER les parties disponibles
        if (req.method === 'GET' && action === 'list') {
            const { data, error } = await supabase
                .from('games')
                .select('id, players')
                .eq('status', 'waiting');
            
            if (error) throw error;
            
            const games = (data || []).map(g => ({
                id: g.id,
                players: g.players.length
            }));
            
            return res.status(200).json({ success: true, games });
        }

        // CRÉER une partie
        if (req.method === 'POST' && action === 'create') {
            const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const newGame = {
                id: gameId,
                board: Array(6).fill().map(() => Array(7).fill(null)),
                currentPlayer: 'red',
                players: ['red'],
                status: 'waiting',
                winner: null,
                lastMove: null
            };

            const { error } = await supabase.from('games').insert(newGame);
            
            if (error) throw error;

            return res.status(200).json({
                success: true,
                gameId,
                player: 'red',
                game: newGame
            });
        }

        // REJOINDRE une partie
        if (req.method === 'POST' && action === 'join' && id) {
            const { data: game, error: fetchError } = await supabase
                .from('games')
                .select('*')
                .eq('id', id)
                .single();
            
            if (fetchError || !game) {
                return res.status(404).json({ success: false, error: 'Partie non trouvée' });
            }
            
            if (game.players.length >= 2) {
                return res.status(400).json({ success: false, error: 'Partie complète' });
            }
            
            game.players.push('yellow');
            game.status = 'playing';
            
            const { error } = await supabase
                .from('games')
                .update({ 
                    players: game.players, 
                    status: 'playing' 
                })
                .eq('id', id);
            
            if (error) throw error;
            
            return res.status(200).json({
                success: true,
                gameId: id,
                player: 'yellow',
                game
            });
        }

        // JOUER un coup
        if (req.method === 'POST' && action === 'move' && id) {
            const { data: game, error: fetchError } = await supabase
                .from('games')
                .select('*')
                .eq('id', id)
                .single();
            
            if (fetchError || !game) {
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
            
            // Changer de joueur (sans vérif victoire pour simplifier)
            game.currentPlayer = player === 'red' ? 'yellow' : 'red';
            game.lastMove = { row: rowPlayed, column, player };
            
            const { error } = await supabase
                .from('games')
                .update({
                    board: game.board,
                    currentPlayer: game.currentPlayer,
                    lastMove: game.lastMove
                })
                .eq('id', id);
            
            if (error) throw error;
            
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

        // RÉCUPÉRER état
        if (req.method === 'GET' && id) {
            const { data: game, error } = await supabase
                .from('games')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error || !game) {
                return res.status(404).json({ success: false, error: 'Partie non trouvée' });
            }
            
            return res.status(200).json({ success: true, game });
        }

        return res.status(400).json({ success: false, error: 'Action non supportée' });
        
    } catch (error) {
        console.error('Erreur Supabase:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur: ' + error.message 
        });
    }
}