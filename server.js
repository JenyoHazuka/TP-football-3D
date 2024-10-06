// Importation des modules nécessaires pour créer un serveur et gérer les connexions en temps réel
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Création d'une application Express pour servir les fichiers côté client
const app = express();

// Création d'un serveur HTTP à partir de l'application Express
const server = http.createServer(app);

// Initialisation de Socket.IO pour ajouter des fonctionnalités de communication en temps réel au serveur
const io = socketIo(server);

// Utilisation d'Express pour servir les fichiers statiques (HTML, CSS, JS) situés dans le dossier "public"
app.use(express.static(__dirname + '/public'));

// Variable pour stocker les joueurs connectés, chaque joueur sera identifié par un ID unique
let players = {};

// Variables pour stocker la position et la vitesse de la balle
let ball = {
    x: 0,
    y: 1, // Position Y (au-dessus du sol)
    z: 0,
    velocityX: 0, // Vitesse initiale en X
    velocityZ: 0  // Vitesse initiale en Z
};

// Variables pour les positions des buts
const leftGoalPosition = -14;  // Position X du but gauche
const rightGoalPosition = 14;  // Position X du but droit

// Position initiale de la balle
const initialBallPosition = {
    x: 0,
    y: 1, // pour être sur le sol
    z: 0
};

// Fonction pour réinitialiser la balle au centre
function resetBall() {
    ball.x = initialBallPosition.x;
    ball.y = initialBallPosition.y;
    ball.z = initialBallPosition.z;
    ball.velocityX = 0;
    ball.velocityZ = 0;

    // Envoyer la position de la balle à tous les clients
    io.emit('ballPosition', ball);
}

// Intervalle pour mettre à jour la position de la balle et envoyer les informations aux clients
setInterval(() => {
    // Mise à jour de la position de la balle en fonction de sa vélocité
    ball.x += ball.velocityX;
    ball.z += ball.velocityZ;

    // Appliquer une légère décélération (simule la friction)
    ball.velocityX *= 0.99;
    ball.velocityZ *= 0.99;

    // Limiter la balle pour qu'elle ne sorte pas des murs (rebond)
    if (ball.x <= -14 || ball.x >= 14) {
        ball.velocityX = -ball.velocityX;
    }
    if (ball.z <= -9 || ball.z >= 9) {
        ball.velocityZ = -ball.velocityZ;
    }

    // Détection des buts
    // Remplacez ces valeurs par celles correspondant à vos buts
    const leftGoalXMin = -15; // limite gauche
    const leftGoalXMax = -12; // limite droite
    const rightGoalXMin = 12;  // limite gauche
    const rightGoalXMax = 15;  // limite droite

    // Vérifier si la balle est dans la zone des buts
    if ((ball.x >= leftGoalXMin && ball.x <= leftGoalXMax && ball.z <= 5 && ball.z >= -5) ||
        (ball.x >= rightGoalXMin && ball.x <= rightGoalXMax && ball.z <= 5 && ball.z >= -5)) {
        console.log('But marqué!');
        resetBall();  // Réinitialiser la balle après un but
    }

    // Envoyer la position actuelle de la balle à tous les clients
    io.emit('ballPosition', ball);
}, 16); // Environ 60 fois par seconde

// Gestion des événements lorsqu'un utilisateur se connecte au serveur
io.on('connection', (socket) => {
    console.log('Nouvel utilisateur connecté :', socket.id);

    // Lorsqu'un nouveau joueur se connecte, on lui attribue un cube dans l'espace 3D.
    // Les coordonnées X et Z sont générées aléatoirement pour placer chaque joueur à un endroit différent.
    // Chaque joueur a aussi une couleur aléatoire.
    players[socket.id] = {
        id: socket.id, // ID unique pour identifier le joueur
        x: Math.random() * 10 - 5, // Position X du joueur (aléatoire)
        y: 1, // Position Y (1 car les joueurs sont sur le sol)
        z: Math.random() * 10 - 5, // Position Z du joueur (aléatoire)
        color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Couleur aléatoire
    };

    // Envoyer la liste de tous les joueurs actuels au nouveau joueur
    socket.emit('init', players);

    // Informer tous les autres joueurs qu'un nouveau joueur vient de se connecter
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Lorsqu'un joueur se déplace, il envoie sa nouvelle position au serveur
    socket.on('move', (data) => {
        // Mettre à jour la position du joueur dans la liste des joueurs
        players[socket.id].x = data.x;
        players[socket.id].z = data.z;

        // Envoyer les nouvelles coordonnées du joueur à tous les autres joueurs connectés
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // Lorsqu'un joueur entre en collision avec la balle, il envoie l'information au serveur
    socket.on('ballCollision', (collisionData) => {
        // Mettre à jour la vitesse de la balle en fonction de la collision
        ball.velocityX = collisionData.velocityX;
        ball.velocityZ = collisionData.velocityZ;

        // Envoyer la nouvelle position et la vitesse de la balle à tous les clients
        io.emit('ballPosition', ball);
    });

    // Gestion de la déconnexion d'un joueur
    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté :', socket.id);

        // Retirer le joueur de la liste des joueurs connectés
        delete players[socket.id];

        // Informer tous les autres joueurs qu'un joueur s'est déconnecté
        io.emit('playerDisconnected', socket.id);
    });

});

// Le serveur écoute les connexions sur le port 3000
server.listen(3000, () => {
    console.log('Serveur démarré sur le port 3000');
});